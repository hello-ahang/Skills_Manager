/**
 * Pure HTML/SVG/CSS rendering for the skill card. Split out of
 * skillCardService.ts to keep that file under the 800-line cap and
 * isolate the "template / view" layer from the "extract + AI" layer.
 *
 * No I/O, no fetch, no env. Inputs in → string out. Everything user-
 * derived runs through escapeHtml — the iframe sandbox + view-route CSP
 * are belt-and-braces.
 */
import type { SkillCardData, SkillCardRubric } from './skillCardService.js';

// ==================== Helpers (exported for unit tests) ====================

export function escapeHtml(s: string): string {
  return s.replace(/[<>&"']/g, m => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&#39;',
  }[m]!));
}

export function formatCardDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ==================== Rubric gauge ====================

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

// ==================== CSS (inlined into output) ====================

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

// ==================== Page assembly ====================

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
    <span>${escapeHtml(formatCardDate(new Date()))}</span>
  </div>
</div>
</body>
</html>`;
}
