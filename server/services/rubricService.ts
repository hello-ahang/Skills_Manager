import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { parseYamlField } from '../utils/yamlUtils.js';

// ==================== Types ====================
// Rubric service uses its own compact type definitions internally.
// The canonical shared types are in src/types/index.ts for frontend use.

export type RubricDimensionId = 'L1' | 'L2' | 'L3' | 'L4';
export type RubricPriority = 'essential' | 'important' | 'optional' | 'pitfall';
export type RubricItemResult = 'pass' | 'fail' | 'skip';

export interface RubricItem {
  id: string;
  label: string;
  priority: RubricPriority;
  weight: number;
  check: 'static' | 'ai';
}

export interface RubricDimension {
  id: RubricDimensionId;
  label: string;
  weight: number;
  items: RubricItem[];
}

export interface RubricTemplate {
  id: string;
  name: string;
  version: string;
  dimensions: RubricDimension[];
}

export interface RubricItemReport {
  itemId: string;
  result: RubricItemResult;
  score: number;       // 0 or 1
  weight: number;
  detail: string;
  suggestion?: string;
}

export interface RubricDimensionReport {
  dimensionId: RubricDimensionId;
  label: string;
  weight: number;
  score: number;       // 0-100
  items: RubricItemReport[];
}

export interface RubricReport {
  skillName: string;
  skillPath: string;
  templateId: string;
  overallScore: number;  // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  dimensions: RubricDimensionReport[];
  evaluatedAt: string;
}

// ==================== Constants ====================

const PRIORITY_WEIGHT: Record<RubricPriority, number> = {
  essential: 1.0,
  important: 0.7,
  optional: 0.3,
  pitfall: 0.9,
};

const RUBRIC_TEMPLATES_DIR = path.join(os.homedir(), '.skills-manager', 'rubric-templates');

// ==================== SKILL.md Parser (independent) ====================

interface ParsedSkillMd {
  raw: string;
  frontmatter: string | null;
  body: string;
  name?: string;
  description?: string;
}

async function parseSkillMdForRubric(skillDir: string): Promise<ParsedSkillMd | null> {
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  if (!await fs.pathExists(skillMdPath)) return null;

  const raw = await fs.readFile(skillMdPath, 'utf-8');
  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---/);

  if (!fmMatch) {
    return { raw, frontmatter: null, body: raw };
  }

  const frontmatter = fmMatch[1];
  const body = raw.slice(fmMatch[0].length);
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  const name = nameMatch ? nameMatch[1].trim().replace(/^['"]|['"]$/g, '') : undefined;
  const description = parseYamlField(frontmatter, 'description');

  return { raw, frontmatter, body, name, description };
}

// ==================== Default Rubric Template ====================

export function getDefaultRubricTemplate(): RubricTemplate {
  return {
    id: 'default',
    name: 'Skills Manager Default Rubric',
    version: '1.0.0',
    dimensions: [
      {
        id: 'L1',
        label: '结构完整性',
        weight: 0.30,
        items: [
          { id: 'frontmatter-exists', label: 'Frontmatter 存在', priority: 'essential', weight: PRIORITY_WEIGHT.essential, check: 'static' },
          { id: 'name-exists', label: 'name 字段存在', priority: 'essential', weight: PRIORITY_WEIGHT.essential, check: 'static' },
          { id: 'description-exists', label: 'description 字段存在', priority: 'essential', weight: PRIORITY_WEIGHT.essential, check: 'static' },
          { id: 'skill-md-structure', label: 'Body 包含标题结构', priority: 'important', weight: PRIORITY_WEIGHT.important, check: 'static' },
          { id: 'refs-valid', label: '引用文件有效', priority: 'important', weight: PRIORITY_WEIGHT.important, check: 'static' },
          { id: 'file-organization', label: '目录结构规范', priority: 'optional', weight: PRIORITY_WEIGHT.optional, check: 'static' },
        ],
      },
      {
        id: 'L2',
        label: '描述质量',
        weight: 0.30,
        items: [
          { id: 'desc-length-adequate', label: 'Description 长度适当', priority: 'important', weight: PRIORITY_WEIGHT.important, check: 'static' },
          { id: 'desc-trigger-words', label: '包含触发词', priority: 'important', weight: PRIORITY_WEIGHT.important, check: 'static' },
          { id: 'desc-scenario-clarity', label: '场景描述清晰', priority: 'essential', weight: PRIORITY_WEIGHT.essential, check: 'ai' },
          { id: 'desc-info-density', label: '信息密度合理', priority: 'optional', weight: PRIORITY_WEIGHT.optional, check: 'ai' },
        ],
      },
      {
        id: 'L3',
        label: '内容深度',
        weight: 0.25,
        items: [
          { id: 'instructions-clarity', label: '指令清晰度', priority: 'essential', weight: PRIORITY_WEIGHT.essential, check: 'ai' },
          { id: 'constraints-completeness', label: '约束完整性', priority: 'important', weight: PRIORITY_WEIGHT.important, check: 'ai' },
          { id: 'examples-quality', label: '示例质量', priority: 'optional', weight: PRIORITY_WEIGHT.optional, check: 'ai' },
          { id: 'actionability', label: '可操作性', priority: 'important', weight: PRIORITY_WEIGHT.important, check: 'ai' },
        ],
      },
      {
        id: 'L4',
        label: '安全与规范',
        weight: 0.15,
        items: [
          { id: 'no-api-keys', label: '无 API Key 泄露', priority: 'pitfall', weight: PRIORITY_WEIGHT.pitfall, check: 'static' },
          { id: 'no-passwords', label: '无密码硬编码', priority: 'pitfall', weight: PRIORITY_WEIGHT.pitfall, check: 'static' },
          { id: 'no-internal-urls', label: '无内网 URL', priority: 'important', weight: PRIORITY_WEIGHT.important, check: 'static' },
          { id: 'naming-consistency', label: '命名一致性', priority: 'important', weight: PRIORITY_WEIGHT.important, check: 'static' },
          { id: 'no-ambiguous-instructions', label: '无模糊指令', priority: 'optional', weight: PRIORITY_WEIGHT.optional, check: 'static' },
        ],
      },
    ],
  };
}

// ==================== Static Check Patterns ====================

const API_KEY_PATTERNS: RegExp[] = [
  /sk-[a-zA-Z0-9]{20,}/g,
  /AKIA[A-Z0-9]{16}/g,
  /gh[pousr]_[A-Za-z0-9]{36,}/g,
  /AIza[0-9A-Za-z\-_]{35}/g,
  /[aA][pP][iI][_-]?[kK][eE][yY]\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/g,
];

const PASSWORD_PATTERNS: RegExp[] = [
  /(?:password|passwd|pwd|secret)\s*[:=]\s*['"][^'"]{6,}['"]/gi,
];

const INTERNAL_URL_PATTERNS: RegExp[] = [
  /https?:\/\/[\w\-\.]+\.alibaba-inc\.com/gi,
  /https?:\/\/[\w\-\.]+\.taobao\.org/gi,
  /https?:\/\/[\w\-\.]+\.alipay\.net/gi,
  /https?:\/\/(?:127\.0\.0\.1|localhost|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)/gi,
];

const TRIGGER_KEYWORDS = [
  '当用户', '使用此', '使用本', '触发', '场景',
  'when user', 'when the user', 'use this', 'use when',
];

const AMBIGUOUS_PHRASES = [
  /(?:^|\n)\s*(?:做好|处理好|搞定|弄好|优化好|完善)\s*[。\n]/g,
  /(?:^|\n)\s*(?:do it well|handle it|make it good|fix it)\s*[.\n]/gi,
];

// ==================== Static Evaluation ====================

function resetPatterns(patterns: RegExp[]): void {
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
  }
}

function testPatterns(content: string, patterns: RegExp[]): boolean {
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) {
      pattern.lastIndex = 0;
      return true;
    }
  }
  return false;
}

export async function evaluateStatic(
  skillDir: string,
  template: RubricTemplate,
): Promise<RubricItemReport[]> {
  const reports: RubricItemReport[] = [];
  const parsed = await parseSkillMdForRubric(skillDir);

  const staticItems: RubricItem[] = [];
  for (const dimension of template.dimensions) {
    for (const item of dimension.items) {
      if (item.check === 'static') {
        staticItems.push(item);
      }
    }
  }

  for (const item of staticItems) {
    try {
      const report = await evaluateStaticItem(item, parsed, skillDir);
      reports.push(report);
    } catch {
      reports.push({
        itemId: item.id,
        result: 'skip',
        score: 0,
        weight: item.weight,
        detail: '检查执行异常，已跳过',
      });
    }
  }

  return reports;
}

async function evaluateStaticItem(
  item: RubricItem,
  parsed: ParsedSkillMd | null,
  skillDir: string,
): Promise<RubricItemReport> {
  const base = { itemId: item.id, weight: item.weight };

  if (!parsed && item.id !== 'file-organization') {
    return { ...base, result: 'fail', score: 0, detail: 'SKILL.md 文件不存在' };
  }

  switch (item.id) {
    case 'frontmatter-exists': {
      const pass = !!parsed?.frontmatter;
      return {
        ...base,
        result: pass ? 'pass' : 'fail',
        score: pass ? 1 : 0,
        detail: pass ? 'Frontmatter 存在' : '缺少 --- 包裹的 frontmatter',
        suggestion: pass ? undefined : '在 SKILL.md 顶部添加 --- 包裹的 YAML frontmatter',
      };
    }

    case 'name-exists': {
      const pass = !!parsed?.name;
      return {
        ...base,
        result: pass ? 'pass' : 'fail',
        score: pass ? 1 : 0,
        detail: pass ? `name: ${parsed!.name}` : 'name 字段缺失',
        suggestion: pass ? undefined : '在 frontmatter 中添加 name 字段',
      };
    }

    case 'description-exists': {
      const pass = !!parsed?.description;
      return {
        ...base,
        result: pass ? 'pass' : 'fail',
        score: pass ? 1 : 0,
        detail: pass ? 'description 字段存在' : 'description 字段缺失',
        suggestion: pass ? undefined : '在 frontmatter 中添加 description 字段',
      };
    }

    case 'skill-md-structure': {
      const hasHeading = /^#{1,2}\s+.+/m.test(parsed?.body || '');
      return {
        ...base,
        result: hasHeading ? 'pass' : 'fail',
        score: hasHeading ? 1 : 0,
        detail: hasHeading ? 'Body 包含标题结构' : 'Body 中缺少 # 或 ## 标题',
        suggestion: hasHeading ? undefined : '在 SKILL.md body 中添加结构化标题',
      };
    }

    case 'refs-valid': {
      const raw = parsed?.raw || '';
      const refMentions = [...raw.matchAll(/references\/([a-zA-Z0-9_\-\.]+)/g)];
      if (refMentions.length === 0) {
        return { ...base, result: 'pass', score: 1, detail: '无引用文件需要检查' };
      }
      const missing: string[] = [];
      for (const match of refMentions) {
        const refPath = path.join(skillDir, 'references', match[1]);
        if (!await fs.pathExists(refPath)) {
          missing.push(match[1]);
        }
      }
      const pass = missing.length === 0;
      return {
        ...base,
        result: pass ? 'pass' : 'fail',
        score: pass ? 1 : 0,
        detail: pass ? '所有引用文件均存在' : `缺失引用文件: ${missing.join(', ')}`,
        suggestion: pass ? undefined : '创建缺失的引用文件或修正引用路径',
      };
    }

    case 'file-organization': {
      try {
        const entries = await fs.readdir(skillDir);
        const unexpected = entries.filter(
          entry => !entry.startsWith('.') && entry !== 'SKILL.md' && entry !== 'references',
        );
        const pass = unexpected.length === 0;
        return {
          ...base,
          result: 'pass',  // 宽松检查，始终 pass
          score: pass ? 1 : 0.5,
          detail: pass
            ? '目录结构规范'
            : `存在额外文件/目录: ${unexpected.slice(0, 3).join(', ')}${unexpected.length > 3 ? ' 等' : ''}`,
          suggestion: pass ? undefined : '建议只保留 SKILL.md 和 references/ 目录',
        };
      } catch {
        return { ...base, result: 'skip', score: 0, detail: '无法读取目录' };
      }
    }

    case 'desc-length-adequate': {
      const descLen = parsed?.description?.length || 0;
      const pass = descLen >= 30 && descLen <= 1000;
      return {
        ...base,
        result: pass ? 'pass' : 'fail',
        score: pass ? 1 : 0,
        detail: pass
          ? `description 长度适当（${descLen} 字符）`
          : `description 长度不合适（${descLen} 字符，建议 30-1000）`,
        suggestion: pass ? undefined : descLen < 30
          ? '扩充 description，清晰说明用途和触发场景'
          : '精简 description，详细内容放到 body 中',
      };
    }

    case 'desc-trigger-words': {
      const descLower = (parsed?.description || '').toLowerCase();
      const hasTrigger = TRIGGER_KEYWORDS.some(kw => descLower.includes(kw.toLowerCase()));
      return {
        ...base,
        result: hasTrigger ? 'pass' : 'fail',
        score: hasTrigger ? 1 : 0,
        detail: hasTrigger ? '包含触发词' : '缺少明确的触发场景描述',
        suggestion: hasTrigger ? undefined : '添加 "当用户..." / "use when..." 等触发词',
      };
    }

    case 'no-api-keys': {
      const hasKey = testPatterns(parsed?.raw || '', API_KEY_PATTERNS);
      return {
        ...base,
        result: hasKey ? 'fail' : 'pass',
        score: hasKey ? 0 : 1,
        detail: hasKey ? '检测到疑似 API Key' : '未发现 API Key 泄露',
        suggestion: hasKey ? '移除硬编码的密钥，使用环境变量' : undefined,
      };
    }

    case 'no-passwords': {
      const hasPassword = testPatterns(parsed?.raw || '', PASSWORD_PATTERNS);
      return {
        ...base,
        result: hasPassword ? 'fail' : 'pass',
        score: hasPassword ? 0 : 1,
        detail: hasPassword ? '检测到疑似密码硬编码' : '未发现密码硬编码',
        suggestion: hasPassword ? '避免硬编码密码，使用环境变量' : undefined,
      };
    }

    case 'no-internal-urls': {
      const hasInternalUrl = testPatterns(parsed?.raw || '', INTERNAL_URL_PATTERNS);
      return {
        ...base,
        result: hasInternalUrl ? 'fail' : 'pass',
        score: hasInternalUrl ? 0 : 1,
        detail: hasInternalUrl ? '检测到内网 URL' : '未发现内网 URL',
        suggestion: hasInternalUrl ? '将内网 URL 替换为占位符或外部链接' : undefined,
      };
    }

    case 'naming-consistency': {
      if (!parsed?.name) {
        return { ...base, result: 'skip', score: 0, detail: 'name 字段缺失，无法检查一致性' };
      }
      const dirName = path.basename(skillDir);
      const dirNameNoVersion = dirName.replace(/-\d+(\.\d+)*$/, '');
      const pass = parsed.name === dirName || parsed.name === dirNameNoVersion;
      return {
        ...base,
        result: pass ? 'pass' : 'fail',
        score: pass ? 1 : 0,
        detail: pass
          ? '名称与目录名一致'
          : `name（${parsed.name}）与目录名（${dirName}）不一致`,
        suggestion: pass ? undefined : '保持 name 与目录名一致',
      };
    }

    case 'no-ambiguous-instructions': {
      const body = parsed?.body || '';
      const hasAmbiguous = AMBIGUOUS_PHRASES.some(pattern => {
        pattern.lastIndex = 0;
        return pattern.test(body);
      });
      return {
        ...base,
        result: hasAmbiguous ? 'fail' : 'pass',
        score: hasAmbiguous ? 0 : 1,
        detail: hasAmbiguous ? '检测到模糊指令（如 "做好"、"处理好"）' : '未发现过于模糊的指令',
        suggestion: hasAmbiguous ? '将模糊指令替换为具体、可操作的描述' : undefined,
      };
    }

    default:
      return { ...base, result: 'skip', score: 0, detail: `未知检查项: ${item.id}` };
  }
}

// ==================== AI Evaluation ====================

interface AIModelConfig {
  baseUrl: string;
  apiKey: string;
  modelName: string;
}

interface AICheckResult {
  itemId: string;
  result: 'pass' | 'fail';
  detail: string;
  suggestion: string;
}

export async function evaluateAI(
  skillDir: string,
  template: RubricTemplate,
  modelConfig: AIModelConfig,
): Promise<RubricItemReport[]> {
  const parsed = await parseSkillMdForRubric(skillDir);
  if (!parsed) {
    const aiItems: RubricItem[] = [];
    for (const dimension of template.dimensions) {
      for (const item of dimension.items) {
        if (item.check === 'ai') aiItems.push(item);
      }
    }
    return aiItems.map(item => ({
      itemId: item.id,
      result: 'skip' as RubricItemResult,
      score: 0,
      weight: item.weight,
      detail: 'SKILL.md 文件不存在，无法进行 AI 评测',
    }));
  }

  const aiItems: RubricItem[] = [];
  for (const dimension of template.dimensions) {
    for (const item of dimension.items) {
      if (item.check === 'ai') aiItems.push(item);
    }
  }

  if (aiItems.length === 0) return [];

  const itemDescriptions = aiItems.map(item => `- ${item.id}: ${item.label}`).join('\n');

  const prompt = `你是一个 Skill 质量评审专家。请评估以下 SKILL.md 的内容质量。

需要评估的检查项：
${itemDescriptions}

各检查项含义：
- desc-scenario-clarity: description 中是否清晰描述了使用场景，用户能否快速理解何时该用这个 Skill
- desc-info-density: description 信息密度是否合理，既不空洞也不冗余
- instructions-clarity: SKILL.md body 中的指令是否清晰明确，AI 能否准确执行
- constraints-completeness: 约束条件是否完整，覆盖边界情况和限制
- examples-quality: 是否包含高质量的示例或用法说明
- actionability: 整体内容是否具有可操作性，AI 读后能否直接行动

请返回 JSON（不要 markdown 代码块），格式如下：
{
  "results": [
    { "itemId": "检查项ID", "result": "pass或fail", "detail": "简要说明", "suggestion": "改进建议（pass时为空字符串）" }
  ]
}`;

  const messages = [
    { role: 'system', content: prompt },
    {
      role: 'user',
      content: `SKILL.md 完整内容：\n\n${parsed.raw}`,
    },
  ];

  try {
    const response = await fetch(`${modelConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${modelConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: modelConfig.modelName,
        messages,
        max_tokens: 2048,
      }),
      signal: AbortSignal.timeout(90000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`AI API ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || '{}';
    const jsonStr = content.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed_response = JSON.parse(jsonStr) as { results?: AICheckResult[] };

    const resultMap = new Map<string, AICheckResult>();
    if (Array.isArray(parsed_response.results)) {
      for (const result of parsed_response.results) {
        resultMap.set(result.itemId, result);
      }
    }

    return aiItems.map(item => {
      const aiResult = resultMap.get(item.id);
      if (!aiResult) {
        return {
          itemId: item.id,
          result: 'skip' as RubricItemResult,
          score: 0,
          weight: item.weight,
          detail: 'AI 未返回该检查项结果',
        };
      }
      const pass = aiResult.result === 'pass';
      return {
        itemId: item.id,
        result: pass ? 'pass' as RubricItemResult : 'fail' as RubricItemResult,
        score: pass ? 1 : 0,
        weight: item.weight,
        detail: aiResult.detail,
        suggestion: aiResult.suggestion || undefined,
      };
    });
  } catch (error) {
    return aiItems.map(item => ({
      itemId: item.id,
      result: 'skip' as RubricItemResult,
      score: 0,
      weight: item.weight,
      detail: `AI 评测失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }));
  }
}

// ==================== Comprehensive Evaluation ====================

export async function evaluateSkill(
  skillName: string,
  skillDir: string,
  options?: {
    templateId?: string;
    aiModelConfig?: AIModelConfig;
  },
): Promise<RubricReport> {
  const template = await getRubricTemplate(options?.templateId);

  const staticReports = await evaluateStatic(skillDir, template);

  let aiReports: RubricItemReport[] = [];
  if (options?.aiModelConfig) {
    try {
      aiReports = await evaluateAI(skillDir, template, options.aiModelConfig);
    } catch {
      // AI evaluation failure should not block the report
    }
  }

  const allItemReports = new Map<string, RubricItemReport>();
  for (const report of staticReports) {
    allItemReports.set(report.itemId, report);
  }
  for (const report of aiReports) {
    allItemReports.set(report.itemId, report);
  }

  const dimensionReports: RubricDimensionReport[] = template.dimensions.map(dimension => {
    const itemReports: RubricItemReport[] = dimension.items.map(item => {
      return allItemReports.get(item.id) || {
        itemId: item.id,
        result: 'skip' as RubricItemResult,
        score: 0,
        weight: item.weight,
        detail: '未评测（AI 评测未启用）',
      };
    });

    const totalWeight = itemReports.reduce((sum, report) => sum + report.weight, 0);
    const weightedScore = itemReports.reduce(
      (sum, report) => sum + report.score * report.weight,
      0,
    );
    const dimensionScore = totalWeight > 0
      ? (weightedScore / totalWeight) * 100
      : 0;

    return {
      dimensionId: dimension.id,
      label: dimension.label,
      weight: dimension.weight,
      score: Math.round(dimensionScore * 100) / 100,
      items: itemReports,
    };
  });

  const overallScore = dimensionReports.reduce(
    (sum, dimension) => sum + dimension.score * dimension.weight,
    0,
  );

  const roundedScore = Math.round(overallScore * 100) / 100;

  const grade: RubricReport['grade'] =
    roundedScore >= 90 ? 'A' :
    roundedScore >= 80 ? 'B' :
    roundedScore >= 70 ? 'C' :
    roundedScore >= 60 ? 'D' : 'F';

  return {
    skillName,
    skillPath: skillDir,
    templateId: template.id,
    overallScore: roundedScore,
    grade,
    dimensions: dimensionReports,
    evaluatedAt: new Date().toISOString(),
  };
}

// ==================== Template Management ====================

export async function loadRubricTemplates(): Promise<RubricTemplate[]> {
  try {
    if (!await fs.pathExists(RUBRIC_TEMPLATES_DIR)) {
      return [];
    }
    const files = await fs.readdir(RUBRIC_TEMPLATES_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    const templates: RubricTemplate[] = [];
    for (const file of jsonFiles) {
      try {
        const content = await fs.readFile(path.join(RUBRIC_TEMPLATES_DIR, file), 'utf-8');
        const template = JSON.parse(content) as RubricTemplate;
        if (template.id && template.dimensions) {
          templates.push(template);
        }
      } catch {
        // skip invalid template files
      }
    }
    return templates;
  } catch {
    return [];
  }
}

export async function saveRubricTemplate(template: RubricTemplate): Promise<void> {
  await fs.ensureDir(RUBRIC_TEMPLATES_DIR);
  const filePath = path.join(RUBRIC_TEMPLATES_DIR, `${template.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(template, null, 2), 'utf-8');
}

export async function getRubricTemplate(templateId?: string): Promise<RubricTemplate> {
  if (!templateId || templateId === 'default') {
    return getDefaultRubricTemplate();
  }

  const templates = await loadRubricTemplates();
  const found = templates.find(t => t.id === templateId);
  if (found) return found;

  return getDefaultRubricTemplate();
}
