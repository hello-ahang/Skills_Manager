import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { AnalyticsEvent, AnalyticsEventType, SkillUsageStats, AnalyticsDashboard } from '../../src/types/index.js';
import { getDb } from '../db/sqlite.js';
import { safeParseJsonRecord } from '../utils/json.js';

const MAX_AGE_DAYS = 90;

// ==================== Helpers ====================

interface DbAnalyticsRow {
  id: string;
  skill_path: string;
  skill_name: string;
  event_type: string;
  timestamp: string;
  metadata: string | null;
}

function rowToEvent(row: DbAnalyticsRow): AnalyticsEvent {
  return {
    id: row.id,
    skillPath: row.skill_path,
    skillName: row.skill_name,
    eventType: row.event_type as AnalyticsEventType,
    timestamp: row.timestamp,
    metadata: row.metadata ? safeParseJsonRecord(row.metadata) : undefined,
  };
}

// Day-grained guard so autoClean doesn't issue a DELETE on every read.
const AUTO_CLEAN_INTERVAL_MS = 24 * 60 * 60 * 1000;
let lastAutoCleanAt = 0;
function autoClean(): void {
  if (Date.now() - lastAutoCleanAt < AUTO_CLEAN_INTERVAL_MS) return;
  lastAutoCleanAt = Date.now();
  const db = getDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);
  db.prepare('DELETE FROM analytics_events WHERE timestamp < ?').run(cutoff.toISOString());
}

// Mtime-aware cache for SKILL.md frontmatter parsing. Without this the
// dashboard re-reads every SKILL.md on every GET (N+1 file reads).
const skillMetaCache = new Map<string, { mtimeMs: number; meta: { name?: string; description?: string } }>();

function readAllEvents(): AnalyticsEvent[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM analytics_events ORDER BY timestamp ASC').all() as DbAnalyticsRow[];
  return rows.map(rowToEvent);
}

function extractSkillName(skillPath: string): string {
  return path.basename(skillPath) || skillPath;
}

function normalizeToSkillDir(filePath: string): string {
  const ext = path.extname(filePath);
  if (ext) {
    return path.dirname(filePath);
  }
  return filePath;
}

async function parseSkillMeta(skillDir: string): Promise<{ name?: string; description?: string }> {
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  try {
    if (!await fs.pathExists(skillMdPath)) {
      skillMetaCache.delete(skillDir);
      return {};
    }
    const stat = await fs.stat(skillMdPath);
    const cached = skillMetaCache.get(skillDir);
    if (cached && cached.mtimeMs === stat.mtimeMs) {
      return cached.meta;
    }

    const content = await fs.readFile(skillMdPath, 'utf-8');
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    let name: string | undefined;
    let description: string | undefined;
    if (match) {
      const frontmatter = match[1];
      for (const line of frontmatter.split('\n')) {
        const nameMatch = line.match(/^name:\s*(.+)/);
        if (nameMatch) name = nameMatch[1].trim().replace(/^["']|["']$/g, '');
        const descMatch = line.match(/^description:\s*(.+)/);
        if (descMatch) description = descMatch[1].trim().replace(/^["']|["']$/g, '');
      }
    }
    const meta = { name, description };
    skillMetaCache.set(skillDir, { mtimeMs: stat.mtimeMs, meta });
    return meta;
  } catch {
    return {};
  }
}

// ==================== Public API ====================

export async function recordEvent(
  skillPath: string,
  skillName: string,
  eventType: AnalyticsEventType,
  metadata?: Record<string, string>
): Promise<void> {
  const db = getDb();
  db.prepare(
    'INSERT INTO analytics_events (id, skill_path, skill_name, event_type, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    uuidv4(),
    skillPath,
    skillName || extractSkillName(skillPath),
    eventType,
    new Date().toISOString(),
    metadata ? JSON.stringify(metadata) : null
  );
}

export async function getDashboard(): Promise<AnalyticsDashboard> {
  autoClean();
  const events = readAllEvents();

  const today = new Date().toISOString().slice(0, 10);
  const todayEvents = events.filter(e => e.timestamp.slice(0, 10) === today).length;

  const skillMap = new Map<string, { name: string; count: number; stats: SkillUsageStats }>();

  for (const e of events) {
    const key = normalizeToSkillDir(e.skillPath);
    const folderName = extractSkillName(key);
    const skillName = e.skillName || folderName;
    if (!skillMap.has(key)) {
      skillMap.set(key, {
        name: skillName,
        count: 0,
        stats: {
          skillPath: key,
          skillName,
          folderName,
          totalViews: 0,
          totalEdits: 0,
          totalLinks: 0,
          aiOptimizeCount: 0,
          aiGenerateCount: 0,
          exportCount: 0,
          versionCount: 0,
        },
      });
    }

    const entry = skillMap.get(key)!;
    entry.count++;

    switch (e.eventType) {
      case 'view': entry.stats.totalViews++; break;
      case 'edit':
      case 'save': entry.stats.totalEdits++; break;
      case 'link':
      case 'unlink': entry.stats.totalLinks++; break;
      case 'ai-optimize': entry.stats.aiOptimizeCount++; break;
      case 'ai-generate': entry.stats.aiGenerateCount++; break;
      case 'export': entry.stats.exportCount++; break;
      case 'version-create':
      case 'version-restore': entry.stats.versionCount++; break;
    }

    if (!entry.stats.lastActivityAt || e.timestamp > entry.stats.lastActivityAt) {
      entry.stats.lastActivityAt = e.timestamp;
    }
  }

  const skillStats = Array.from(skillMap.values())
    .map(e => e.stats)
    .sort((a, b) => {
      const aTotal = a.totalViews + a.totalEdits + a.aiOptimizeCount + a.aiGenerateCount + a.exportCount + a.versionCount;
      const bTotal = b.totalViews + b.totalEdits + b.aiOptimizeCount + b.aiGenerateCount + b.exportCount + b.versionCount;
      return bTotal - aTotal;
    });

  await Promise.all(
    skillStats.map(async (stat) => {
      const meta = await parseSkillMeta(stat.skillPath);
      if (meta.name) stat.skillName = meta.name;
      if (meta.description) stat.description = meta.description;
    })
  );

  let mostActiveSkill: { name: string; folderName: string; description?: string; count: number } | undefined;
  for (const entry of skillMap.values()) {
    if (!mostActiveSkill || entry.count > mostActiveSkill.count) {
      const stat = skillStats.find(s => s.skillPath === entry.stats.skillPath);
      mostActiveSkill = {
        name: stat?.skillName || entry.name,
        folderName: entry.stats.folderName,
        description: stat?.description,
        count: entry.count,
      };
    }
  }

  const recentRaw = [...events].reverse().slice(0, 30);
  // parseSkillMeta itself is mtime-cached at module level — no need for a
  // per-call Map here. Calls coalesce to a single fs.stat per unique dir.
  const recentActivity = await Promise.all(
    recentRaw.map(async (e) => {
      const dir = normalizeToSkillDir(e.skillPath);
      const meta = await parseSkillMeta(dir);
      return {
        ...e,
        skillName: meta.name || e.skillName || extractSkillName(dir),
        metadata: {
          ...e.metadata,
          ...(meta.description ? { description: meta.description } : {}),
        },
      };
    })
  );

  return {
    overview: {
      totalEvents: events.length,
      totalSkillsTracked: skillMap.size,
      mostActiveSkill,
      todayEvents,
    },
    skillStats,
    recentActivity,
  };
}

export async function getSkillStats(skillPath: string): Promise<SkillUsageStats | null> {
  const dashboard = await getDashboard();
  return dashboard.skillStats.find(s => s.skillPath === skillPath) || null;
}

export async function getRecentActivity(limit: number = 30): Promise<AnalyticsEvent[]> {
  autoClean();
  const db = getDb();
  const rows = db.prepare('SELECT * FROM analytics_events ORDER BY timestamp DESC LIMIT ?').all(limit) as DbAnalyticsRow[];
  return rows.map(rowToEvent);
}

export async function clearAll(): Promise<void> {
  const db = getDb();
  db.prepare('DELETE FROM analytics_events').run();
}
