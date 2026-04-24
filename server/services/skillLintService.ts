import fs from 'fs-extra';
import path from 'path';
import { parseYamlField } from '../utils/yamlUtils.js';

// ==================== Types ====================

export type LintLevel = 'error' | 'warning' | 'info';

export interface LintIssue {
  level: LintLevel;
  rule: string;
  message: string;
  suggestion?: string;
}

export interface SkillMetrics {
  descLength: number;
  fileSize: number;       // SKILL.md 行数
  refsCount: number;      // references/ 目录文件数
  hasFrontmatter: boolean;
  hasName: boolean;
  hasDescription: boolean;
}

export interface AIAssessment {
  descQualityScore: number;       // 0-100
  descSuggestions: string[];
}

export interface SkillHealthReport {
  skillName: string;
  skillPath: string;
  score: number;                  // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: LintIssue[];
  metrics: SkillMetrics;
  aiAssessment?: AIAssessment;
}

// ==================== Helper: parse SKILL.md ====================

interface ParsedSkillMd {
  raw: string;
  frontmatter: string | null;
  body: string;
  name?: string;
  description?: string;
  lines: number;
}

async function parseSkillMd(skillDir: string): Promise<ParsedSkillMd | null> {
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  if (!await fs.pathExists(skillMdPath)) return null;

  const raw = await fs.readFile(skillMdPath, 'utf-8');
  const lines = raw.split('\n').length;
  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---/);

  if (!fmMatch) {
    return { raw, frontmatter: null, body: raw, lines };
  }

  const frontmatter = fmMatch[1];
  const body = raw.slice(fmMatch[0].length);
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  const name = nameMatch ? nameMatch[1].trim().replace(/^['"]|['"]$/g, '') : undefined;
  const description = parseYamlField(frontmatter, 'description');

  return { raw, frontmatter, body, name, description, lines };
}

// ==================== Lint Rules ====================

// 触发词检测：description 中是否包含明确的触发场景描述
const TRIGGER_KEYWORDS = [
  '当用户', '使用此', '使用本', '触发', '场景',
  'when user', 'when the user', 'use this', 'use when',
];

// API Key 模式
const API_KEY_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'OpenAI sk-xxx', pattern: /sk-[a-zA-Z0-9]{20,}/g },
  { name: 'AWS Access Key', pattern: /AKIA[A-Z0-9]{16}/g },
  { name: 'GitHub Token', pattern: /gh[pousr]_[A-Za-z0-9]{36,}/g },
  { name: 'Google API Key', pattern: /AIza[0-9A-Za-z\-_]{35}/g },
  { name: 'Generic API Key', pattern: /[aA][pP][iI][_-]?[kK][eE][yY]\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/g },
];

// 内网 URL 模式
const INTERNAL_URL_PATTERNS: RegExp[] = [
  /https?:\/\/[\w\-\.]+\.alibaba-inc\.com/gi,
  /https?:\/\/[\w\-\.]+\.taobao\.org/gi,
  /https?:\/\/[\w\-\.]+\.alipay\.net/gi,
  /https?:\/\/(?:127\.0\.0\.1|localhost|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)/gi,
];

// 密码硬编码模式
const PASSWORD_PATTERNS: RegExp[] = [
  /(?:password|passwd|pwd|secret)\s*[:=]\s*['"][^'"]{6,}['"]/gi,
];

/**
 * Run static lint checks on a Skill directory.
 */
export async function lintSkill(skillDir: string): Promise<{ issues: LintIssue[]; metrics: SkillMetrics }> {
  const issues: LintIssue[] = [];
  const parsed = await parseSkillMd(skillDir);

  // 基础 metrics
  const metrics: SkillMetrics = {
    descLength: 0,
    fileSize: 0,
    refsCount: 0,
    hasFrontmatter: false,
    hasName: false,
    hasDescription: false,
  };

  if (!parsed) {
    issues.push({
      level: 'error',
      rule: 'skill-md-missing',
      message: 'SKILL.md 文件不存在',
      suggestion: '在 Skill 目录下创建 SKILL.md 文件',
    });
    return { issues, metrics };
  }

  metrics.fileSize = parsed.lines;
  metrics.hasFrontmatter = !!parsed.frontmatter;
  metrics.hasName = !!parsed.name;
  metrics.hasDescription = !!parsed.description;
  metrics.descLength = parsed.description?.length || 0;

  // 统计 references 目录文件数
  const refsDir = path.join(skillDir, 'references');
  if (await fs.pathExists(refsDir)) {
    try {
      const refs = await fs.readdir(refsDir);
      metrics.refsCount = refs.filter(f => !f.startsWith('.')).length;
    } catch {
      // ignore
    }
  }

  // ========== 类别1: description 质量 ==========
  if (!parsed.description) {
    issues.push({
      level: 'error',
      rule: 'desc-missing',
      message: 'description 字段缺失',
      suggestion: '在 frontmatter 中添加 description 字段，描述 Skill 的用途和触发场景',
    });
  } else {
    if (parsed.description.length < 30) {
      issues.push({
        level: 'warning',
        rule: 'desc-too-short',
        message: `description 过短（${parsed.description.length} 字符），AI 可能难以正确触发`,
        suggestion: 'description 建议 50-500 字符，清晰说明用途、触发场景和触发词',
      });
    }
    if (parsed.description.length > 1000) {
      issues.push({
        level: 'warning',
        rule: 'desc-too-long',
        message: `description 过长（${parsed.description.length} 字符），会消耗过多上下文 token`,
        suggestion: 'description 建议精简到 1000 字符以内，详细内容放到 SKILL.md 主体',
      });
    }
    const descLower = parsed.description.toLowerCase();
    const hasTrigger = TRIGGER_KEYWORDS.some(kw => descLower.includes(kw.toLowerCase()));
    if (!hasTrigger) {
      issues.push({
        level: 'info',
        rule: 'desc-no-trigger',
        message: 'description 缺少明确的触发场景描述',
        suggestion: '建议添加 "当用户..." / "use when..." 等触发词，提升 AI 触发准确率',
      });
    }
  }

  // ========== 类别2: SKILL.md 结构 ==========
  if (!parsed.frontmatter) {
    issues.push({
      level: 'error',
      rule: 'frontmatter-missing',
      message: '缺少 YAML frontmatter（--- 包裹的元数据）',
      suggestion: '在 SKILL.md 顶部添加 --- 包裹的 name 和 description',
    });
  }
  if (!parsed.name) {
    issues.push({
      level: 'error',
      rule: 'name-missing',
      message: 'name 字段缺失',
      suggestion: '在 frontmatter 中添加 name 字段',
    });
  }
  if (parsed.lines > 500) {
    issues.push({
      level: 'warning',
      rule: 'file-too-large',
      message: `SKILL.md 行数过多（${parsed.lines} 行），会大量消耗上下文 token`,
      suggestion: '建议控制在 500 行内，长内容拆到 references/ 目录按需引用',
    });
  }
  // references 引用检查：扫描 SKILL.md 中提到的 references/xxx 文件是否存在
  const refMentions = parsed.raw.matchAll(/references\/([a-zA-Z0-9_\-\.]+)/g);
  for (const m of refMentions) {
    const refFile = m[1];
    const refPath = path.join(skillDir, 'references', refFile);
    if (!await fs.pathExists(refPath)) {
      issues.push({
        level: 'warning',
        rule: 'refs-not-found',
        message: `引用的文件 references/${refFile} 不存在`,
        suggestion: `创建该文件或更新 SKILL.md 中的引用路径`,
      });
    }
  }

  // ========== 类别3: 安全检测 ==========
  for (const { name, pattern } of API_KEY_PATTERNS) {
    if (pattern.test(parsed.raw)) {
      issues.push({
        level: 'error',
        rule: 'secret-api-key',
        message: `检测到疑似 ${name}，存在密钥泄露风险`,
        suggestion: '移除硬编码的密钥，使用环境变量或外部配置',
      });
    }
    pattern.lastIndex = 0;
  }
  for (const pattern of PASSWORD_PATTERNS) {
    if (pattern.test(parsed.raw)) {
      issues.push({
        level: 'warning',
        rule: 'secret-password',
        message: '检测到疑似密码硬编码',
        suggestion: '避免在 Skill 中硬编码密码，使用环境变量或外部配置',
      });
    }
    pattern.lastIndex = 0;
  }
  for (const pattern of INTERNAL_URL_PATTERNS) {
    if (pattern.test(parsed.raw)) {
      issues.push({
        level: 'warning',
        rule: 'secret-internal-url',
        message: '检测到内网 URL，分享时可能泄露内部信息',
        suggestion: '如果需要公开分享，请将内网 URL 替换为占位符或外部链接',
      });
    }
    pattern.lastIndex = 0;
  }

  // ========== 类别4: 一致性 ==========
  if (parsed.name) {
    const dirName = path.basename(skillDir);
    // 允许 name 与目录名完全一致或带版本号变体
    const dirNameNoVer = dirName.replace(/-\d+(\.\d+)*$/, '');
    if (parsed.name !== dirName && parsed.name !== dirNameNoVer) {
      issues.push({
        level: 'warning',
        rule: 'name-mismatch',
        message: `name 字段（${parsed.name}）与目录名（${dirName}）不一致`,
        suggestion: '保持 name 与目录名一致，便于识别和检索',
      });
    }
  }
  // 子文件命名规范：检查 references 下文件是否符合 kebab-case 或 snake_case
  if (metrics.refsCount > 0) {
    const refsDir = path.join(skillDir, 'references');
    try {
      const refs = await fs.readdir(refsDir);
      const badNames = refs.filter(f => {
        if (f.startsWith('.')) return false;
        const base = f.replace(/\.[^.]+$/, '');
        // 允许 kebab-case (a-b-c) 或 snake_case (a_b_c) 或纯字母数字
        return !/^[a-z0-9]+([_-][a-z0-9]+)*$/i.test(base);
      });
      if (badNames.length > 0) {
        issues.push({
          level: 'info',
          rule: 'naming-snake-case',
          message: `部分 references 文件命名不规范: ${badNames.slice(0, 3).join(', ')}${badNames.length > 3 ? ' 等' : ''}`,
          suggestion: '推荐使用 kebab-case（如 my-helper.md）或 snake_case（如 my_helper.md）',
        });
      }
    } catch {
      // ignore
    }
  }

  return { issues, metrics };
}

// ==================== Health Score Calculation ====================

const ISSUE_WEIGHTS: Record<LintLevel, number> = {
  error: 25,
  warning: 8,
  info: 2,
};

/**
 * Calculate health score (0-100) based on lint issues and metrics.
 */
export function calculateHealthScore(issues: LintIssue[], metrics: SkillMetrics): number {
  let score = 100;

  for (const issue of issues) {
    score -= ISSUE_WEIGHTS[issue.level];
  }

  // 关键缺失直接降为 0-30 区间
  if (!metrics.hasFrontmatter || !metrics.hasName || !metrics.hasDescription) {
    score = Math.min(score, 30);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function scoreToGrade(score: number): SkillHealthReport['grade'] {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/**
 * Generate full health report for a Skill.
 * When aiModelConfig is provided and description exists, also runs AI assessment.
 */
export async function generateHealthReport(
  skillName: string,
  skillDir: string,
  options?: { aiModelConfig?: ModelConfig }
): Promise<SkillHealthReport> {
  const { issues, metrics } = await lintSkill(skillDir);
  const score = calculateHealthScore(issues, metrics);

  const report: SkillHealthReport = {
    skillName,
    skillPath: skillDir,
    score,
    grade: scoreToGrade(score),
    issues,
    metrics,
  };

  // AI assessment (optional, token-consuming)
  if (options?.aiModelConfig && metrics.hasDescription) {
    try {
      const parsed = await parseSkillMd(skillDir);
      if (parsed?.description) {
        report.aiAssessment = await aiAssessDescription(
          skillName,
          parsed.description,
          options.aiModelConfig
        );
      }
    } catch {
      // AI assessment failure should not block the report
    }
  }

  return report;
}

// ==================== Get Skill Description (for batch AI assess) ====================

/**
 * Quick helper to extract description from a Skill directory.
 * Used by batch route to avoid re-running full lint just to get description.
 */
export async function getSkillDescription(skillDir: string): Promise<string | undefined> {
  const parsed = await parseSkillMd(skillDir);
  return parsed?.description;
}

// ==================== AI Assessment (optional) ====================

interface ModelConfig {
  baseUrl: string;
  apiKey: string;
  modelName: string;
}

/**
 * Use AI model to assess description quality and provide suggestions.
 * Consumes tokens, should be called on-demand.
 */
export async function aiAssessDescription(
  skillName: string,
  description: string,
  modelConfig: ModelConfig
): Promise<AIAssessment> {
  const messages = [
    {
      role: 'system',
      content: `你是一个 Skill description 质量评审专家。请评估给定 Skill 的 description 字段质量。

评估维度：
1. 清晰度：能否清楚说明 Skill 的用途
2. 触发明确性：是否有明确的触发场景和触发词
3. 完整性：是否包含必要信息（用途/场景/限制）
4. 简洁性：是否冗余啰嗦
5. AI 友好度：AI 模型能否基于此 description 准确判断何时触发

请返回 JSON（不要 markdown 代码块）：
{
  "descQualityScore": 85,
  "descSuggestions": [
    "建议1：具体改进点",
    "建议2：具体改进点"
  ]
}

descQualityScore 范围 0-100。descSuggestions 至多 3 条，每条具体可操作。`,
    },
    {
      role: 'user',
      content: `Skill 名称: ${skillName}\n\nDescription:\n${description}`,
    },
  ];

  const response = await fetch(`${modelConfig.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${modelConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: modelConfig.modelName,
      messages,
      max_tokens: 1024,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`AI API ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || '{}';
  const jsonStr = content.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      descQualityScore: typeof parsed.descQualityScore === 'number' ? parsed.descQualityScore : 0,
      descSuggestions: Array.isArray(parsed.descSuggestions) ? parsed.descSuggestions : [],
    };
  } catch {
    return { descQualityScore: 0, descSuggestions: ['AI 返回结果解析失败'] };
  }
}
