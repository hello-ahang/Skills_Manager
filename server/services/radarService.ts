import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { getConfig } from './configService.js';
import { getHistory } from './importHistoryService.js';
import { getDb } from '../db/sqlite.js';
import type { SkillVersion } from '../../src/types/index.js';
import { parseYamlField } from '../utils/yamlUtils.js';

const USER_CONFIG_DIR = path.join(os.homedir(), '.skills-manager');

export interface RadarSkillSource {
  source: 'library' | 'project' | 'import-history';
  sourceName: string;
}

export interface RadarSkillItem {
  name: string;
  description?: string;
  source: 'library' | 'project' | 'import-history';
  sourceName: string;
  sources?: RadarSkillSource[];  // Multiple sources when deduplicated
  path?: string;
  realPath?: string;  // Resolved real path for dedup
  contentSummary?: string;
  version?: string;
  tags?: string[];
  category?: string;
  rubricGrade?: 'A' | 'B' | 'C' | 'D' | 'F';
  rubricScore?: number;  // 0-100
  usageCount?: number;
}

/**
 * Parse YAML frontmatter from SKILL.md content.
 * Returns { name, description } or null.
 */
function parseSkillFrontmatter(content: string): { name?: string; description?: string } | null {
  // Try YAML frontmatter first
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const frontmatter = fmMatch[1];
    const result: { name?: string; description?: string } = {};
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    if (nameMatch) result.name = nameMatch[1].trim().replace(/^['"]|['"]$/g, '');
    result.description = parseYamlField(frontmatter, 'description');
    return (result.name || result.description) ? result : null;
  }

  // Fallback: try non-frontmatter patterns
  const result: { name?: string; description?: string } = {};
  const nameMatch = content.match(/^name:\s*(.+)$/m);
  if (nameMatch) result.name = nameMatch[1].trim();
  result.description = parseYamlField(content, 'description');
  if (!result.description) {
    const fallbackMatch = content.match(/^>\s*(.+)$/m);
    if (fallbackMatch) result.description = fallbackMatch[1].trim();
  }
  return (result.name || result.description) ? result : null;
}

/**
 * Extract a content summary from SKILL.md (first 500 chars, excluding frontmatter).
 */
function extractContentSummary(content: string, maxLen = 500): string {
  // Remove frontmatter
  let body = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '');
  // Remove leading empty lines
  body = body.replace(/^\s*\n/, '');
  // Truncate
  if (body.length > maxLen) {
    body = body.substring(0, maxLen) + '...';
  }
  return body.trim();
}

/**
 * Scan a directory for valid Skills (directories containing SKILL.md).
 * Returns RadarSkillItem[] with source info.
 */
async function scanDirForSkills(
  dirPath: string,
  source: 'library' | 'project',
  sourceName: string
): Promise<RadarSkillItem[]> {
  const skills: RadarSkillItem[] = [];

  if (!await fs.pathExists(dirPath)) return skills;

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

      const skillDir = path.join(dirPath, entry.name);
      const skillMdPath = path.join(skillDir, 'SKILL.md');

      if (!await fs.pathExists(skillMdPath)) continue;

      try {
        const content = await fs.readFile(skillMdPath, 'utf-8');
        const meta = parseSkillFrontmatter(content);

        skills.push({
          name: meta?.name || entry.name,
          description: meta?.description,
          source,
          sourceName,
          path: skillDir,
          contentSummary: extractContentSummary(content),
        });
      } catch {
        // Skip unreadable files
        skills.push({
          name: entry.name,
          source,
          sourceName,
          path: skillDir,
        });
      }
    }
  } catch {
    // Directory not readable
  }

  return skills;
}

/**
 * Aggregate all Skills from all Skills library directories (sourceDirs).
 */
export async function aggregateAllSkills(sourceDirId?: string): Promise<RadarSkillItem[]> {
  const config = await getConfig();
  const allSkills: RadarSkillItem[] = [];

  // Scan source directories (Skills libraries)
  if (config.sourceDirs && config.sourceDirs.length > 0) {
    const dirsToScan = sourceDirId
      ? config.sourceDirs.filter((d: { id: string }) => d.id === sourceDirId)
      : config.sourceDirs;

    for (const dir of dirsToScan) {
      const dirPath = dir.path.startsWith('~/') || dir.path === '~'
        ? path.join(os.homedir(), dir.path.slice(1))
        : dir.path;

      const librarySkills = await scanDirForSkills(
        dirPath,
        'library',
        dir.name || 'Skills 库'
      );
      allSkills.push(...librarySkills);
    }
  } else if (config.sourceDir) {
    // Fallback: single sourceDir (legacy)
    const expandedPath = config.sourceDir.startsWith('~/') || config.sourceDir === '~'
      ? path.join(os.homedir(), config.sourceDir.slice(1))
      : config.sourceDir;

    const librarySkills = await scanDirForSkills(
      expandedPath,
      'library',
      'Skills 库'
    );
    allSkills.push(...librarySkills);
  }

  // ── Enrich with version info from versions index ──
  const versionsIndexPath = path.join(USER_CONFIG_DIR, 'versions', 'index.json');
  let latestVersionMap = new Map<string, string>();
  try {
    if (await fs.pathExists(versionsIndexPath)) {
      const allVersions: { skillPath: string; version: string; createdAt: string }[] = await fs.readJson(versionsIndexPath);
      // Build map: skillPath → latest version (by createdAt)
      for (const v of allVersions) {
        const existing = latestVersionMap.get(v.skillPath);
        if (!existing) {
          latestVersionMap.set(v.skillPath, v.version);
        }
        // allVersions is already ordered or we pick the latest
      }
      // Re-scan to pick latest by createdAt
      const versionsByPath = new Map<string, { version: string; createdAt: string }>();
      for (const v of allVersions) {
        const ex = versionsByPath.get(v.skillPath);
        if (!ex || v.createdAt > ex.createdAt) {
          versionsByPath.set(v.skillPath, { version: v.version, createdAt: v.createdAt });
        }
      }
      latestVersionMap = new Map<string, string>();
      for (const [sp, info] of versionsByPath) {
        latestVersionMap.set(sp, info.version);
      }
    }
  } catch {
    // Versions index not available
  }

  // Pre-compute realpath → version once, so the inner skill loop is O(1).
  // The previous double-loop with per-iteration fs.realpath was O(N·M)
  // syscalls — 10k+ syscalls for a library with ~100 skills × 100 versions.
  const versionByRealPath = new Map<string, string>();
  await Promise.all(
    Array.from(latestVersionMap.entries()).map(async ([vPath, vVer]) => {
      try {
        const real = await fs.realpath(vPath);
        // Only set if not already set (first wins; latestVersionMap order is
        // unspecified, but conflicts are rare and tied versions are equivalent).
        if (!versionByRealPath.has(real)) {
          versionByRealPath.set(real, vVer);
        }
      } catch {
        // skip unreachable version paths
      }
    }),
  );

  // Match version to skills by path (exact first, then resolved realpath).
  for (const skill of allSkills) {
    if (!skill.path) continue;
    const ver = latestVersionMap.get(skill.path);
    if (ver) {
      skill.version = ver;
      continue;
    }
    try {
      const realPath = await fs.realpath(skill.path);
      const realVer = versionByRealPath.get(realPath);
      if (realVer) skill.version = realVer;
    } catch {
      // skip
    }
  }

  // ── Dedup: merge skills with same real path (symlink-aware) ──
  const deduped: RadarSkillItem[] = [];
  const realPathMap = new Map<string, RadarSkillItem>();

  for (const skill of allSkills) {
    // Import-history skills skip dedup (path may not exist)
    if (skill.source === 'import-history' || !skill.path) {
      deduped.push(skill);
      continue;
    }

    // Resolve real path for library/project skills
    let realPath: string;
    try {
      realPath = await fs.realpath(skill.path);
    } catch {
      // Path not resolvable, keep as-is
      deduped.push(skill);
      continue;
    }

    skill.realPath = realPath;

    const existing = realPathMap.get(realPath);
    if (existing) {
      // Merge: add this source to existing item's sources array
      if (!existing.sources) {
        existing.sources = [{ source: existing.source, sourceName: existing.sourceName }];
      }
      existing.sources.push({ source: skill.source, sourceName: skill.sourceName });

      // Prefer library source info (name/description/contentSummary)
      if (skill.source === 'library') {
        existing.name = skill.name;
        existing.description = skill.description || existing.description;
        existing.contentSummary = skill.contentSummary || existing.contentSummary;
        existing.source = 'library';
        existing.sourceName = skill.sourceName;
      }
    } else {
      // First occurrence
      skill.sources = [{ source: skill.source, sourceName: skill.sourceName }];
      realPathMap.set(realPath, skill);
      deduped.push(skill);
    }
  }

  // ── Enrich with Rubric scores and usage stats ──
  const [rubricCache, usageStats] = await Promise.all([
    loadRubricCache(),
    loadUsageStats(),
  ]);

  for (const skill of deduped) {
    const rubric = rubricCache[skill.name];
    if (rubric) {
      skill.rubricGrade = rubric.grade;
      skill.rubricScore = rubric.score;
    }
    skill.usageCount = usageStats[skill.name] || 0;
  }

  return deduped;
}

/**
 * Map import source ID to display name.
 */
function getSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    github: 'GitHub',
    clawhub: 'ClawHub',
    local: '本地文件',
    zip: 'ZIP 压缩包',
    clipboard: '剪贴板',
    batch: '批量导入',
    csv: 'CSV 导入',
    json: 'JSON 导入',
  };
  return labels[source] || source;
}

// ==================== Radar Data Persistence ====================

const RADAR_TAGS_PATH = path.join(USER_CONFIG_DIR, 'radar-tags.json');
const RADAR_SUMMARY_PATH = path.join(USER_CONFIG_DIR, 'radar-summary.json');

/**
 * Load radar tags from local file.
 */
export async function loadRadarTags(): Promise<Record<string, string[]>> {
  try {
    if (await fs.pathExists(RADAR_TAGS_PATH)) {
      return await fs.readJson(RADAR_TAGS_PATH);
    }
  } catch {
    // File not readable or invalid JSON
  }
  return {};
}

/**
 * Save radar tags to local file.
 */
export async function saveRadarTags(tags: Record<string, string[]>): Promise<void> {
  await fs.ensureDir(USER_CONFIG_DIR);
  await fs.writeJson(RADAR_TAGS_PATH, tags, { spaces: 2 });
}

/**
 * Load radar summary from local file.
 */
export async function loadRadarSummary(): Promise<any | null> {
  try {
    if (await fs.pathExists(RADAR_SUMMARY_PATH)) {
      return await fs.readJson(RADAR_SUMMARY_PATH);
    }
  } catch {
    // File not readable or invalid JSON
  }
  return null;
}

/**
 * Save radar summary to local file.
 */
export async function saveRadarSummary(summary: any): Promise<void> {
  await fs.ensureDir(USER_CONFIG_DIR);
  await fs.writeJson(RADAR_SUMMARY_PATH, summary, { spaces: 2 });
}

// ==================== Rubric Score Cache (SQLite-backed) ====================
//
// Backed by `rubric_cache` table in ~/.skills-manager/db.sqlite. Reads/writes
// go through better-sqlite3 (synchronous), so concurrent route handlers can
// no longer drop updates the way the previous JSON RMW pattern did.

export interface RubricCacheEntry {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  score: number;  // 0-100
  evaluatedAt: string;
}

interface RubricCacheRow {
  skill_name: string;
  grade: string;
  score: number;
  evaluated_at: string;
}

function rowToRubricEntry(row: RubricCacheRow): RubricCacheEntry {
  return {
    grade: row.grade as RubricCacheEntry['grade'],
    score: row.score,
    evaluatedAt: row.evaluated_at,
  };
}

/**
 * Load cached Rubric scores. Returns a map: skillName → entry.
 */
export async function loadRubricCache(): Promise<Record<string, RubricCacheEntry>> {
  const db = getDb();
  const rows = db.prepare('SELECT skill_name, grade, score, evaluated_at FROM rubric_cache').all() as RubricCacheRow[];
  const out: Record<string, RubricCacheEntry> = {};
  for (const row of rows) {
    out[row.skill_name] = rowToRubricEntry(row);
  }
  return out;
}

/**
 * Replace the entire Rubric cache (used by full-refresh flows).
 */
export async function saveRubricCache(cache: Record<string, RubricCacheEntry>): Promise<void> {
  const db = getDb();
  const upsert = db.prepare(
    `INSERT INTO rubric_cache (skill_name, grade, score, evaluated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(skill_name) DO UPDATE SET
       grade = excluded.grade,
       score = excluded.score,
       evaluated_at = excluded.evaluated_at`
  );
  const tx = db.transaction((entries: [string, RubricCacheEntry][]) => {
    db.prepare('DELETE FROM rubric_cache').run();
    for (const [name, entry] of entries) {
      upsert.run(name, entry.grade, Math.round(entry.score), entry.evaluatedAt);
    }
  });
  tx(Object.entries(cache));
}

/**
 * Update a single entry in the Rubric cache. Atomic via UPSERT — concurrent
 * callers may interleave but never lose data.
 */
export async function updateRubricCacheEntry(skillName: string, entry: RubricCacheEntry): Promise<void> {
  const db = getDb();
  db.prepare(
    `INSERT INTO rubric_cache (skill_name, grade, score, evaluated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(skill_name) DO UPDATE SET
       grade = excluded.grade,
       score = excluded.score,
       evaluated_at = excluded.evaluated_at`
  ).run(skillName, entry.grade, Math.round(entry.score), entry.evaluatedAt);
}

// ==================== Usage Stats (SQLite-backed) ====================
//
// Concurrent /api/radar/usage/increment used to drop counts under the JSON
// RMW pattern; SQLite UPSERT guarantees correctness.

interface UsageStatsRow {
  skill_name: string;
  count: number;
  last_used_at: string;
}

/**
 * Load usage stats. Returns a map: skillName → count.
 */
export async function loadUsageStats(): Promise<Record<string, number>> {
  const db = getDb();
  const rows = db.prepare('SELECT skill_name, count FROM usage_stats').all() as Pick<UsageStatsRow, 'skill_name' | 'count'>[];
  const out: Record<string, number> = {};
  for (const row of rows) {
    out[row.skill_name] = row.count;
  }
  return out;
}

/**
 * Replace the entire usage stats table (used by import/export flows).
 */
export async function saveUsageStats(stats: Record<string, number>): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  const upsert = db.prepare(
    `INSERT INTO usage_stats (skill_name, count, last_used_at)
     VALUES (?, ?, ?)
     ON CONFLICT(skill_name) DO UPDATE SET
       count = excluded.count,
       last_used_at = excluded.last_used_at`
  );
  const tx = db.transaction((entries: [string, number][]) => {
    db.prepare('DELETE FROM usage_stats').run();
    for (const [name, count] of entries) {
      upsert.run(name, count, now);
    }
  });
  tx(Object.entries(stats));
}

/**
 * Atomically increment usage count for a skill (UPSERT prevents lost updates
 * under concurrent requests).
 */
export async function incrementUsage(skillName: string): Promise<void> {
  const db = getDb();
  db.prepare(
    `INSERT INTO usage_stats (skill_name, count, last_used_at)
     VALUES (?, 1, ?)
     ON CONFLICT(skill_name) DO UPDATE SET
       count = count + 1,
       last_used_at = excluded.last_used_at`
  ).run(skillName, new Date().toISOString());
}
