import fs from 'fs-extra';
import net from 'net';
import path from 'path';
import { promises as dnsPromises } from 'dns';
import { getFeedbackStats } from './feedbackService.js';
import { getDefaultModelConfig } from './configService.js';

/**
 * Reject private/loopback/link-local addresses to prevent SSRF: a hostile
 * SKILL.md URL that resolves to (or 30x-redirects to) 127.0.0.1, 169.254.x.x
 * cloud metadata, or 10/172.16-31/192.168 internal RFC1918 ranges.
 */
// Exported for unit tests; semantically internal — do not call from
// product code outside SSRF defense. Use isHostnamePrivate() instead,
// which handles DNS resolution and IPv4/IPv6 dispatch.
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return true;
    const [a, b] = parts as [number, number, ...number[]];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;          // ULA
    if (lower.startsWith('fe80')) return true;                                  // link-local
    if (lower.startsWith('::ffff:')) {
      // IPv4-mapped IPv6
      return isPrivateIp(lower.slice(7));
    }
    return false;
  }
  return true;
}

async function isHostnamePrivate(hostname: string): Promise<boolean> {
  if (net.isIP(hostname)) return isPrivateIp(hostname);
  try {
    const addrs = await dnsPromises.lookup(hostname, { all: true });
    return addrs.some(a => isPrivateIp(a.address));
  } catch {
    // DNS failure → treat as suspicious; refuse the fetch.
    return true;
  }
}

// ==================== Types ====================

export type FreshnessLevel = 'fresh' | 'stale' | 'expired';

export interface FreshnessIssue {
  type: 'broken_url' | 'missing_path' | 'negative_feedback' | 'no_recent_activity';
  detail: string;
  severity: 'warning' | 'error';
}

export interface FreshnessReport {
  skillPath: string;
  skillName: string;
  level: FreshnessLevel;
  issues: FreshnessIssue[];
  feedbackRate?: number;       // effective rate from feedback
  lastModifiedAt?: string;     // file last modified time
  daysSinceModified?: number;
  checkedAt: string;
}

export interface FreshnessSuggestion {
  skillPath: string;
  skillName: string;
  issues: FreshnessIssue[];
  suggestions: string[];
}

// ==================== Helpers ====================

/**
 * Extract all URLs from text content.
 */
function extractUrls(content: string): string[] {
  const urlRegex = /https?:\/\/[^\s)>\]"'`]+/g;
  return Array.from(content.matchAll(urlRegex)).map(m => m[0]);
}

/**
 * Extract potential file paths referenced in content.
 * Looks for patterns like: `path/to/file`, ./relative/path, /absolute/path
 */
// Exported for unit tests; internal API otherwise.
export function extractFilePaths(content: string): string[] {
  const pathRegex = /(?:^|\s|`)((?:\.{1,2}\/|\/)[a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)/gm;
  const paths: string[] = [];
  for (const match of content.matchAll(pathRegex)) {
    const p = match[1].trim();
    // Filter out URLs and common false positives
    if (!p.startsWith('http') && !p.startsWith('//') && p.length < 200) {
      paths.push(p);
    }
  }
  return paths;
}

const MAX_REDIRECT_HOPS = 5;

/**
 * Check if a URL is reachable (with timeout).
 *
 * Defends against SSRF by:
 *   - Disabling automatic redirects (`redirect: 'manual'`) and following them
 *     manually so each hop's host can be re-validated.
 *   - Rejecting any URL whose hostname resolves to a private/loopback/
 *     link-local IP at any hop in the redirect chain.
 *   - Allowing only http: and https: schemes (no file:, data:, ftp:).
 */
async function checkUrl(url: string, timeoutMs = 5000): Promise<boolean> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      return false;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    if (await isHostnamePrivate(parsed.hostname)) {
      return false;
    }

    let resp: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      resp = await fetch(current, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'manual',
      });
      clearTimeout(timer);
    } catch {
      return false;
    }

    // 3xx with Location → re-validate the next host. Otherwise return.
    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get('location');
      if (!location) return false;
      // Resolve relative redirects against the current URL.
      try {
        current = new URL(location, current).toString();
      } catch {
        return false;
      }
      continue;
    }

    return resp.ok || resp.status === 405; // 405 = method not allowed but URL exists
  }
  return false;
}

/**
 * Get the last modified time of a directory (latest file mtime).
 */
async function getLastModified(dirPath: string): Promise<Date | null> {
  try {
    if (!await fs.pathExists(dirPath)) return null;
    const stat = await fs.stat(dirPath);
    if (!stat.isDirectory()) return stat.mtime;

    let latest = stat.mtime;
    const entries = await fs.readdir(dirPath);
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry);
      try {
        const entryStat = await fs.stat(entryPath);
        if (entryStat.mtime > latest) {
          latest = entryStat.mtime;
        }
      } catch {
        // Skip inaccessible files
      }
    }
    return latest;
  } catch {
    return null;
  }
}

// ==================== Public API ====================

/**
 * Check freshness of a single Skill.
 */
export async function checkFreshness(skillPath: string): Promise<FreshnessReport> {
  const skillName = path.basename(skillPath);
  const issues: FreshnessIssue[] = [];

  // 1. Read SKILL.md content
  const skillMdPath = path.join(skillPath, 'SKILL.md');
  let content = '';
  try {
    if (await fs.pathExists(skillMdPath)) {
      content = await fs.readFile(skillMdPath, 'utf-8');
    }
  } catch {
    // Skip read errors
  }

  // 2. Check URLs (limit to first 5 to avoid slow scans)
  if (content) {
    const urls = extractUrls(content);
    const urlsToCheck = urls.slice(0, 5);
    const urlResults = await Promise.all(
      urlsToCheck.map(async (url) => ({ url, ok: await checkUrl(url) }))
    );
    for (const { url, ok } of urlResults) {
      if (!ok) {
        issues.push({
          type: 'broken_url',
          detail: `无效链接: ${url}`,
          severity: 'error',
        });
      }
    }
  }

  // 3. Check referenced file paths
  if (content) {
    const filePaths = extractFilePaths(content);
    for (const fp of filePaths.slice(0, 10)) {
      // Resolve relative to skill directory
      const resolved = path.isAbsolute(fp)
        ? fp
        : path.resolve(skillPath, fp);
      if (!await fs.pathExists(resolved)) {
        issues.push({
          type: 'missing_path',
          detail: `引用路径不存在: ${fp}`,
          severity: 'warning',
        });
      }
    }
  }

  // 4. Check feedback trends
  const feedbackStats = await getFeedbackStats();
  const skillFeedback = feedbackStats.find(s => s.skillPath === skillPath);
  let feedbackRate: number | undefined;
  if (skillFeedback) {
    feedbackRate = skillFeedback.effectiveRate;
    if (skillFeedback.ineffective >= 3) {
      issues.push({
        type: 'negative_feedback',
        detail: `多次负面反馈 (${skillFeedback.ineffective} 次无效反馈，有效率 ${skillFeedback.effectiveRate}%)`,
        severity: 'error',
      });
    } else if (skillFeedback.ineffective >= 1 && skillFeedback.effectiveRate < 50) {
      issues.push({
        type: 'negative_feedback',
        detail: `有负面反馈 (有效率 ${skillFeedback.effectiveRate}%)`,
        severity: 'warning',
      });
    }
  }

  // 5. Check last modified time
  const lastModified = await getLastModified(skillPath);
  let lastModifiedAt: string | undefined;
  let daysSinceModified: number | undefined;
  if (lastModified) {
    lastModifiedAt = lastModified.toISOString();
    daysSinceModified = Math.floor((Date.now() - lastModified.getTime()) / 86400000);
    if (daysSinceModified > 90) {
      issues.push({
        type: 'no_recent_activity',
        detail: `超过 ${daysSinceModified} 天未更新`,
        severity: 'warning',
      });
    }
  }

  // 6. Determine freshness level
  let level: FreshnessLevel = 'fresh';
  const hasError = issues.some(i => i.severity === 'error');
  const hasWarning = issues.some(i => i.severity === 'warning');

  if (hasError) {
    level = 'expired';
  } else if (hasWarning) {
    level = 'stale';
  }

  return {
    skillPath,
    skillName,
    level,
    issues,
    feedbackRate,
    lastModifiedAt,
    daysSinceModified,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Batch check freshness for multiple Skills.
 */
export async function batchCheckFreshness(skillPaths: string[]): Promise<FreshnessReport[]> {
  // Run checks in parallel (limit concurrency to 5)
  const results: FreshnessReport[] = [];
  const batchSize = 5;
  for (let i = 0; i < skillPaths.length; i += batchSize) {
    const batch = skillPaths.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(p => checkFreshness(p)));
    results.push(...batchResults);
  }
  return results;
}

/**
 * Generate AI freshness suggestions for a Skill.
 *
 * Reads AI model config server-side via getDefaultModelConfig() — never
 * accept baseUrl/apiKey from request bodies (SSRF + credential exfiltration).
 */
export async function generateFreshSuggestions(
  skillPath: string,
): Promise<FreshnessSuggestion> {
  const report = await checkFreshness(skillPath);
  const suggestions: string[] = [];
  const aiModel = await getDefaultModelConfig();

  // Generate static suggestions based on issues
  for (const issue of report.issues) {
    switch (issue.type) {
      case 'broken_url':
        suggestions.push(`检查并更新失效的链接：${issue.detail.replace('无效链接: ', '')}`);
        break;
      case 'missing_path':
        suggestions.push(`更新或移除不存在的文件引用：${issue.detail.replace('引用路径不存在: ', '')}`);
        break;
      case 'negative_feedback':
        suggestions.push('根据用户反馈改进 Skill 内容，提升使用有效率');
        break;
      case 'no_recent_activity':
        suggestions.push('审查并更新 Skill 内容，确保与最新最佳实践保持一致');
        break;
    }
  }

  // If AI is available, generate more detailed suggestions
  if (aiModel && report.issues.length > 0) {
    try {
      const skillMdPath = path.join(skillPath, 'SKILL.md');
      let content = '';
      if (await fs.pathExists(skillMdPath)) {
        content = await fs.readFile(skillMdPath, 'utf-8');
      }

      if (content) {
        const issuesSummary = report.issues.map(i => `- [${i.severity}] ${i.detail}`).join('\n');
        const prompt = `你是一个 Skill 内容质量顾问。以下 Skill 文件存在保鲜问题，请给出 3-5 条简洁的改进建议（每条不超过 50 字）：

保鲜问题：
${issuesSummary}

Skill 内容（前 2000 字）：
${content.slice(0, 2000)}

请直接输出改进建议列表，每行一条，不要编号。`;

        const resp = await fetch(`${aiModel.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiModel.apiKey}`,
          },
          body: JSON.stringify({
            model: aiModel.modelName,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 500,
            temperature: 0.3,
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          const aiText = data.choices?.[0]?.message?.content || '';
          const aiSuggestions = aiText.split('\n').map((s: string) => s.trim()).filter((s: string) => s.length > 0 && s.length < 100);
          if (aiSuggestions.length > 0) {
            // Replace static suggestions with AI-generated ones
            suggestions.length = 0;
            suggestions.push(...aiSuggestions);
          }
        }
      }
    } catch {
      // Fall back to static suggestions
    }
  }

  return {
    skillPath: report.skillPath,
    skillName: report.skillName,
    issues: report.issues,
    suggestions,
  };
}
