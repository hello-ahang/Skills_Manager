import fs from 'fs-extra';
import path from 'path';
import { parseYamlField, parseYamlList } from '../utils/yamlUtils.js';
import { getDefaultModelConfig } from './configService.js';
import { loadRubricCache } from './radarService.js';
import { getVersionHistory } from './versionService.js';
import { log } from '../utils/logger.js';

// ==================== Types ====================

export interface SkillCardExample {
  title: string;
  description?: string;
}

export interface SkillCardReference {
  name: string;
  firstParagraph?: string;
}

export interface SkillCardRubric {
  overall: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  evaluatedAt?: string;
}

export interface SkillCardData {
  name: string;
  title: string;
  version?: string;
  sourceLabel?: string;
  lastUpdated?: string;
  capabilities: string[];
  scenarios: string[];
  examples: SkillCardExample[];
  related: string[];
  references: SkillCardReference[];
  rubric?: SkillCardRubric;
  aiUsed: boolean;
}

export interface GenerateCardOptions {
  includeAI?: boolean;
}

export interface SkillCardResult {
  html: string;
  data: SkillCardData;
}

interface ParsedSkill {
  raw: string;
  frontmatter: string | null;
  body: string;
  name?: string;
  description?: string;
  related: string[];
}

// ==================== SKILL.md parsing ====================

async function readSkillMd(skillDir: string): Promise<ParsedSkill | null> {
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  if (!await fs.pathExists(skillMdPath)) return null;

  const raw = await fs.readFile(skillMdPath, 'utf-8');
  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    return { raw, frontmatter: null, body: raw, related: [] };
  }

  const frontmatter = fmMatch[1];
  const body = raw.slice(fmMatch[0].length);
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  const name = nameMatch ? nameMatch[1].trim().replace(/^['"]|['"]$/g, '') : undefined;
  const description = parseYamlField(frontmatter, 'description') || undefined;
  const related = parseYamlList(frontmatter, 'related');

  return { raw, frontmatter, body, name, description, related };
}

/**
 * List markdown files in `<skillDir>/references/` together with their first
 * non-empty paragraph (truncated). Used as supporting context for the AI
 * pass and rendered as "延伸阅读" at the bottom of the card.
 */
async function listReferences(skillDir: string): Promise<SkillCardReference[]> {
  const refDir = path.join(skillDir, 'references');
  if (!await fs.pathExists(refDir)) return [];

  let entries: string[];
  try {
    entries = await fs.readdir(refDir);
  } catch {
    return [];
  }

  const mdFiles = entries.filter(e => /\.md$/i.test(e));
  const out: SkillCardReference[] = [];

  for (const name of mdFiles.slice(0, 8)) {
    try {
      const content = await fs.readFile(path.join(refDir, name), 'utf-8');
      const firstParagraph = extractFirstParagraph(content);
      out.push({ name, firstParagraph });
    } catch {
      out.push({ name });
    }
  }
  return out;
}

function extractFirstParagraph(markdown: string): string | undefined {
  const stripped = markdown.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
  const blocks = stripped.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  for (const block of blocks) {
    if (block.startsWith('#')) continue;
    if (block.startsWith('```')) continue;
    const cleaned = block.replace(/\s+/g, ' ').trim();
    if (cleaned.length > 0) {
      return cleaned.length > 200 ? cleaned.slice(0, 200) + '…' : cleaned;
    }
  }
  return undefined;
}

// ==================== Static extraction (AI fallback) ====================

/**
 * Pure-string extraction that produces a usable card without calling any LLM.
 * Used both as the always-on baseline and as a fallback when AI fails.
 */
export function extractStaticCardData(
  parsed: ParsedSkill,
  references: SkillCardReference[],
  fallbackName: string,
): Pick<SkillCardData, 'name' | 'title' | 'capabilities' | 'scenarios' | 'examples' | 'related' | 'references'> {
  const description = parsed.description || '';

  // Title: first sentence of description, capped at 40 chars
  const firstSentence = splitFirstSentence(description);
  const title = firstSentence
    ? truncate(firstSentence, 40)
    : '未提供功能描述';

  // Capabilities: prefer H2 headings from body, fall back to top-level list items
  const headings = collectHeadings(parsed.body, 2).slice(0, 5);
  let capabilities: string[];
  if (headings.length >= 2) {
    capabilities = headings.map(h => truncate(h, 20));
  } else {
    const listItems = collectTopLevelListItems(parsed.body).slice(0, 5);
    capabilities = listItems.length > 0
      ? listItems.map(it => truncate(it, 20))
      : splitDescriptionIntoBullets(description, 3);
  }

  // Scenarios: pull "触发词" / "使用场景" / "适用" markers out of description first
  const scenarios = extractScenarios(description, parsed.body);

  // Examples: look for "## 示例" / "## Examples" section, fall back to nothing
  const examples = extractExamples(parsed.body);

  return {
    name: parsed.name || fallbackName,
    title,
    capabilities,
    scenarios,
    examples,
    related: parsed.related,
    references,
  };
}

function splitFirstSentence(s: string): string | undefined {
  const trimmed = s.trim();
  if (!trimmed) return undefined;
  // Split on first Chinese/English sentence terminator
  const m = trimmed.match(/^([^。.！!？?\n]+[。.！!？?]?)/);
  return m ? m[1].trim() : trimmed;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

function collectHeadings(body: string, level: number): string[] {
  const prefix = '#'.repeat(level);
  const re = new RegExp(`^${prefix}\\s+(.+)$`, 'gm');
  const matches = [...body.matchAll(re)];
  return matches
    .map(m => m[1].trim().replace(/^[#\s]+/, '').replace(/\s+#+\s*$/, ''))
    .filter(s => s.length > 0);
}

function collectTopLevelListItems(body: string): string[] {
  const lines = body.split('\n');
  const items: string[] = [];
  for (const line of lines) {
    const m = line.match(/^[-*+]\s+(.+)$/);
    if (m) {
      const text = m[1].trim().replace(/`/g, '').replace(/\*\*/g, '').replace(/_/g, '');
      // Skip nav/badge lines
      if (text.length >= 2 && text.length <= 80) items.push(text);
    }
    if (items.length >= 8) break;
  }
  return items;
}

function splitDescriptionIntoBullets(description: string, max: number): string[] {
  if (!description) return [];
  // Split on Chinese 、/逗号/分号/句号 to get up to `max` short fragments
  return description
    .replace(/[。.！!？?]/g, '；')
    .split(/[；;,，、]/)
    .map(s => s.trim())
    .filter(s => s.length >= 2 && s.length <= 24)
    .slice(0, max);
}

function extractScenarios(description: string, body: string): string[] {
  const source = `${description}\n${body.slice(0, 800)}`;
  const out: string[] = [];

  // Pattern: "触发词：x、y、z" or "适用场景：…"
  const triggerMatch = source.match(/触发(?:词|场景|条件)[:：]\s*([^\n。]+)/);
  if (triggerMatch) {
    triggerMatch[1]
      .split(/[、,，;；]/)
      .map(s => s.trim().replace(/^["']|["']$/g, ''))
      .filter(s => s.length >= 2 && s.length <= 24)
      .slice(0, 3)
      .forEach(s => out.push(s));
  }

  if (out.length === 0) {
    // Pattern: "when ... use" / "适合 / 当 / 需要"
    const sentenceRe = /(当|需要|适合|如果|想要|希望)[^\n。]{2,30}/g;
    const matches = [...source.matchAll(sentenceRe)];
    for (const m of matches.slice(0, 2)) {
      out.push(truncate(m[0], 24));
    }
  }

  if (out.length === 0 && description) {
    out.push(truncate(description, 24));
  }

  return out.slice(0, 3);
}

function extractExamples(body: string): SkillCardExample[] {
  // Look for an "## 示例" / "## Examples" / "## Usage" section and take
  // its first two H3 / ### subsections, or the first 1-2 paragraphs.
  const startRe = /^##\s+(?:示例|Examples?|用法|Usage)\s*$/im;
  const startMatch = body.match(startRe);
  if (!startMatch || startMatch.index === undefined) return [];

  const afterHeading = body.slice(startMatch.index + startMatch[0].length);
  // End the section at the next ## heading (h2), or end-of-body.
  const nextH2 = afterHeading.search(/\n##\s+\S/);
  const section = nextH2 >= 0 ? afterHeading.slice(0, nextH2) : afterHeading;

  // Try to split section by H3 (### ...) subsections.
  const subParts = section.split(/(?=^###\s+)/m).map(s => s.trim()).filter(Boolean);
  const examples: SkillCardExample[] = [];
  for (const part of subParts) {
    const h3 = part.match(/^###\s+(.+)$/m);
    if (!h3) continue;
    const titleLineEnd = part.indexOf('\n');
    const restAfterHeading = titleLineEnd >= 0 ? part.slice(titleLineEnd + 1) : '';
    const descLine = restAfterHeading
      .split('\n')
      .map(l => l.trim())
      .find(l => l && !l.startsWith('```'));
    examples.push({
      title: h3[1].trim().replace(/`/g, ''),
      description: descLine ? truncate(descLine, 80) : undefined,
    });
    if (examples.length >= 2) break;
  }

  if (examples.length > 0) return examples;

  // No H3 — take first non-code paragraph as a single example
  const para = section
    .split(/\n{2,}/)
    .map(p => p.trim())
    .find(p => p && !p.startsWith('```'));
  if (para) {
    return [{ title: '使用示例', description: truncate(para.replace(/\s+/g, ' '), 80) }];
  }
  return [];
}

// ==================== AI enrichment ====================

interface AICardResponse {
  title?: string;
  capabilities?: string[];
  scenarios?: string[];
  examples?: Array<{ title?: string; description?: string }>;
}

const CARD_AI_TIMEOUT_MS = 60_000;

/**
 * Ask the configured default LLM to rewrite the card's headline content for
 * a non-technical audience. Returns null on any failure — callers must
 * fall back to the static extraction.
 *
 * AI creds always come from getDefaultModelConfig() (server-side). Body of
 * the API request never contains baseUrl/apiKey/modelName — see CLAUDE.md
 * §红线 2.
 */
export async function callAIForCardCopy(
  parsed: ParsedSkill,
  references: SkillCardReference[],
): Promise<AICardResponse | null> {
  const aiModel = await getDefaultModelConfig();
  if (!aiModel) return null;

  const referenceSummary = references.length === 0
    ? '(无)'
    : references
        .map(r => `- ${r.name}${r.firstParagraph ? `: ${r.firstParagraph}` : ''}`)
        .join('\n');

  const prompt = `你是产品文档编辑。把下面这份 Agent Skill 的 SKILL.md 提炼成面向**非技术人员**的简明描述。
严格输出 JSON,不要 markdown fence、不要任何额外文字。

输入:
- name: ${parsed.name || '(未提供)'}
- description: ${parsed.description || '(未提供)'}
- body: ${parsed.body.slice(0, 3000)}
- references:
${referenceSummary}

输出 JSON schema:
{
  "title": "<≤ 20 字,这个 Skill 能给用户带来什么>",
  "capabilities": ["<能力点,≤ 16 字>", ...],
  "scenarios": ["<场景,≤ 20 字>", ...],
  "examples": [
    { "title": "<示例标题>", "description": "<自然语言描述,不要代码>" }
  ]
}

要求:
- capabilities 必须 3-5 条
- scenarios 必须 2-3 条
- examples 必须 1-2 个,description 必须是自然语言,绝对不要代码
- 所有字段都用中文`;

  try {
    const resp = await fetch(`${aiModel.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiModel.apiKey}`,
      },
      body: JSON.stringify({
        model: aiModel.modelName,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(CARD_AI_TIMEOUT_MS),
    });

    if (!resp.ok) {
      log.warn({ status: resp.status }, '[skillCard] AI request failed');
      return null;
    }

    const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data?.choices?.[0]?.message?.content || '';
    const jsonStr = content.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
    const parsedResp = JSON.parse(jsonStr) as AICardResponse;

    return parsedResp;
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : String(err) }, '[skillCard] AI enrichment failed, falling back to static');
    return null;
  }
}

function mergeAIIntoBase(
  base: Pick<SkillCardData, 'name' | 'title' | 'capabilities' | 'scenarios' | 'examples' | 'related' | 'references'>,
  ai: AICardResponse | null,
): SkillCardData {
  if (!ai) {
    return { ...base, aiUsed: false };
  }

  const title = (ai.title && ai.title.trim().length > 0)
    ? truncate(ai.title.trim(), 40)
    : base.title;

  const capabilities = Array.isArray(ai.capabilities) && ai.capabilities.length > 0
    ? ai.capabilities
        .map(c => typeof c === 'string' ? truncate(c.trim(), 20) : '')
        .filter(Boolean)
        .slice(0, 5)
    : base.capabilities;

  const scenarios = Array.isArray(ai.scenarios) && ai.scenarios.length > 0
    ? ai.scenarios
        .map(s => typeof s === 'string' ? truncate(s.trim(), 24) : '')
        .filter(Boolean)
        .slice(0, 3)
    : base.scenarios;

  const examples = Array.isArray(ai.examples) && ai.examples.length > 0
    ? ai.examples
        .filter(e => e && typeof e === 'object' && typeof e.title === 'string')
        .slice(0, 2)
        .map(e => ({
          title: truncate(e.title!.trim(), 40),
          description: e.description ? truncate(String(e.description).trim(), 100) : undefined,
        }))
    : base.examples;

  return {
    ...base,
    title,
    capabilities: capabilities.length > 0 ? capabilities : base.capabilities,
    scenarios: scenarios.length > 0 ? scenarios : base.scenarios,
    examples,
    aiUsed: true,
  };
}

// ==================== Enrichment from existing data sources ====================

async function readRubricFor(skillName: string): Promise<SkillCardRubric | undefined> {
  try {
    const cache = await loadRubricCache();
    const entry = cache[skillName];
    if (!entry) return undefined;
    return {
      overall: entry.score,
      grade: entry.grade,
      evaluatedAt: entry.evaluatedAt,
    };
  } catch {
    return undefined;
  }
}

async function readLatestVersion(skillPath: string): Promise<string | undefined> {
  try {
    const history = await getVersionHistory(skillPath);
    if (history.length === 0) return undefined;
    return history[0].version;
  } catch {
    return undefined;
  }
}

async function readLastModified(skillPath: string): Promise<string | undefined> {
  try {
    const stat = await fs.stat(path.join(skillPath, 'SKILL.md'));
    return formatDate(stat.mtime);
  } catch {
    return undefined;
  }
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ==================== HTML rendering ====================

export function escapeHtml(s: string): string {
  return s.replace(/[<>&"']/g, m => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&#39;',
  }[m]!));
}

function renderRadarSvg(rubric: SkillCardRubric): string {
  // Single-point radar would be misleading — we only have the overall score.
  // Render a circular gauge instead.
  const score = Math.max(0, Math.min(100, Math.round(rubric.overall)));
  const r = 56;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - score / 100);
  const gradeColor: Record<string, string> = {
    A: '#10b981', B: '#0ea5e9', C: '#f59e0b', D: '#f97316', F: '#ef4444',
  };
  const color = gradeColor[rubric.grade] || '#6366f1';
  return `<svg viewBox="0 0 140 140" width="140" height="140" aria-label="质量分">
    <circle cx="70" cy="70" r="${r}" fill="none" stroke="var(--card-border)" stroke-width="10"/>
    <circle cx="70" cy="70" r="${r}" fill="none" stroke="${color}" stroke-width="10"
      stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}"
      stroke-dashoffset="${offset.toFixed(2)}" transform="rotate(-90 70 70)"/>
    <text x="70" y="64" text-anchor="middle" font-size="28" font-weight="700" fill="${color}">${score}</text>
    <text x="70" y="86" text-anchor="middle" font-size="13" fill="var(--card-fg-muted)">质量分 · ${escapeHtml(rubric.grade)}</text>
  </svg>`;
}

const CARD_CSS = `
:root {
  --card-bg: #ffffff;
  --card-fg: #0f172a;
  --card-fg-muted: #64748b;
  --card-border: #e2e8f0;
  --card-chip-bg: #f1f5f9;
  --card-chip-fg: #334155;
  --card-accent: #6366f1;
  --card-accent-soft: #eef2ff;
  --card-success: #10b981;
}
@media (prefers-color-scheme: dark) {
  :root {
    --card-bg: #0f172a;
    --card-fg: #f1f5f9;
    --card-fg-muted: #94a3b8;
    --card-border: #1e293b;
    --card-chip-bg: #1e293b;
    --card-chip-fg: #cbd5e1;
    --card-accent: #a5b4fc;
    --card-accent-soft: #1e1b4b;
    --card-success: #34d399;
  }
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Segoe UI", Helvetica, Arial, sans-serif;
  background: var(--card-bg);
  color: var(--card-fg);
  line-height: 1.55;
  padding: 32px 16px;
  min-height: 100vh;
}
.card {
  max-width: 880px;
  margin: 0 auto;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  padding: 32px 36px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02);
}
@media (prefers-color-scheme: dark) {
  .card { box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3); }
}
.header { display: flex; gap: 24px; align-items: flex-start; justify-content: space-between; margin-bottom: 8px; }
.header-text { flex: 1; min-width: 0; }
.eyebrow { font-size: 12px; color: var(--card-fg-muted); letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 8px; }
.name { font-size: 28px; font-weight: 700; margin: 0 0 8px 0; word-break: break-word; }
.title { font-size: 16px; color: var(--card-fg-muted); margin: 0 0 16px 0; }
.meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; color: var(--card-fg-muted); margin-bottom: 4px; }
.meta-chip { background: var(--card-chip-bg); color: var(--card-chip-fg); padding: 4px 10px; border-radius: 999px; }
.gauge { flex-shrink: 0; }
hr { border: none; border-top: 1px solid var(--card-border); margin: 24px 0; }
section { margin-bottom: 24px; }
section:last-child { margin-bottom: 0; }
.section-title { font-size: 13px; font-weight: 600; color: var(--card-fg-muted); letter-spacing: 0.05em; text-transform: uppercase; margin: 0 0 12px 0; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip {
  background: var(--card-accent-soft); color: var(--card-accent);
  padding: 6px 12px; border-radius: 8px; font-size: 14px; font-weight: 500;
}
.scenarios { display: flex; flex-direction: column; gap: 8px; }
.scenario { display: flex; gap: 12px; align-items: flex-start; }
.scenario-dot {
  width: 6px; height: 6px; border-radius: 50%; background: var(--card-success);
  margin-top: 9px; flex-shrink: 0;
}
.scenario-text { font-size: 15px; color: var(--card-fg); }
.examples { display: flex; flex-direction: column; gap: 12px; }
.example {
  border: 1px solid var(--card-border); border-radius: 10px; padding: 14px 16px;
  background: var(--card-bg);
}
.example-title { font-size: 14px; font-weight: 600; margin: 0 0 4px 0; }
.example-desc { font-size: 13px; color: var(--card-fg-muted); margin: 0; }
.lists { display: flex; flex-wrap: wrap; gap: 24px; }
.list-block { flex: 1; min-width: 220px; }
.list-block ul { margin: 0; padding-left: 18px; }
.list-block li { font-size: 13px; color: var(--card-fg-muted); margin-bottom: 4px; }
.footer {
  margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--card-border);
  font-size: 11px; color: var(--card-fg-muted); display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap;
}
.empty { color: var(--card-fg-muted); font-style: italic; font-size: 13px; }
`;

export function renderCardHtml(data: SkillCardData): string {
  const safe = {
    name: escapeHtml(data.name),
    title: escapeHtml(data.title),
    version: data.version ? escapeHtml(data.version) : '',
    sourceLabel: data.sourceLabel ? escapeHtml(data.sourceLabel) : '',
    lastUpdated: data.lastUpdated ? escapeHtml(data.lastUpdated) : '',
  };

  const metaChips: string[] = [];
  if (safe.version) metaChips.push(`<span class="meta-chip">版本 ${safe.version}</span>`);
  if (safe.sourceLabel) metaChips.push(`<span class="meta-chip">${safe.sourceLabel}</span>`);
  if (safe.lastUpdated) metaChips.push(`<span class="meta-chip">更新于 ${safe.lastUpdated}</span>`);

  const gauge = data.rubric ? `<div class="gauge">${renderRadarSvg(data.rubric)}</div>` : '';

  const capabilitiesHtml = data.capabilities.length > 0
    ? `<div class="chips">${data.capabilities.map(c => `<span class="chip">${escapeHtml(c)}</span>`).join('')}</div>`
    : `<p class="empty">尚未提取到能力清单</p>`;

  const scenariosHtml = data.scenarios.length > 0
    ? `<div class="scenarios">${data.scenarios.map(s => `<div class="scenario"><span class="scenario-dot"></span><span class="scenario-text">${escapeHtml(s)}</span></div>`).join('')}</div>`
    : `<p class="empty">尚未提取到使用场景</p>`;

  const examplesHtml = data.examples.length > 0
    ? `<div class="examples">${data.examples.map(e => `
        <div class="example">
          <p class="example-title">${escapeHtml(e.title)}</p>
          ${e.description ? `<p class="example-desc">${escapeHtml(e.description)}</p>` : ''}
        </div>
      `).join('')}</div>`
    : `<p class="empty">暂无示例</p>`;

  const relatedBlock = data.related.length > 0
    ? `<div class="list-block">
         <p class="section-title">相关 Skill</p>
         <ul>${data.related.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
       </div>`
    : '';

  const referencesBlock = data.references.length > 0
    ? `<div class="list-block">
         <p class="section-title">延伸阅读</p>
         <ul>${data.references.map(r => `<li>${escapeHtml(r.name)}</li>`).join('')}</ul>
       </div>`
    : '';

  const listsHtml = (relatedBlock || referencesBlock)
    ? `<section><div class="lists">${relatedBlock}${referencesBlock}</div></section>`
    : '';

  const generationLabel = data.aiUsed ? 'AI 提炼' : '静态提取';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safe.name} · Skill 卡片</title>
<style>${CARD_CSS}</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div class="header-text">
      <div class="eyebrow">AGENT SKILL</div>
      <h1 class="name">${safe.name}</h1>
      <p class="title">${safe.title}</p>
      <div class="meta">${metaChips.join('') || '<span class="meta-chip">本地 Skill</span>'}</div>
    </div>
    ${gauge}
  </div>
  <hr>
  <section>
    <p class="section-title">能做什么</p>
    ${capabilitiesHtml}
  </section>
  <section>
    <p class="section-title">什么时候用</p>
    ${scenariosHtml}
  </section>
  <section>
    <p class="section-title">使用示例</p>
    ${examplesHtml}
  </section>
  ${listsHtml}
  <div class="footer">
    <span>由 Skills Manager 生成 · ${generationLabel}</span>
    <span>${escapeHtml(formatDate(new Date()))}</span>
  </div>
</div>
</body>
</html>`;
}

// ==================== Top-level orchestration ====================

/**
 * Build a one-screen visual HTML card for the skill at `skillDir`.
 *
 * Pipeline: parse SKILL.md → list references → static extract → optional
 * AI enrichment → attach rubric/version/mtime → render HTML.
 */
export async function generateSkillCard(
  skillDir: string,
  opts: GenerateCardOptions = {},
): Promise<SkillCardResult> {
  const parsed = await readSkillMd(skillDir);
  if (!parsed) {
    throw new Error(`SKILL.md not found at ${skillDir}`);
  }

  const fallbackName = path.basename(skillDir);
  const references = await listReferences(skillDir);
  const base = extractStaticCardData(parsed, references, fallbackName);

  let ai: AICardResponse | null = null;
  if (opts.includeAI !== false) {
    ai = await callAIForCardCopy(parsed, references);
  }

  const merged = mergeAIIntoBase(base, ai);

  const [rubric, version, lastUpdated] = await Promise.all([
    readRubricFor(merged.name),
    readLatestVersion(skillDir),
    readLastModified(skillDir),
  ]);

  const data: SkillCardData = {
    ...merged,
    rubric,
    version,
    lastUpdated,
    sourceLabel: '本地 Skill',
  };

  const html = renderCardHtml(data);
  return { html, data };
}
