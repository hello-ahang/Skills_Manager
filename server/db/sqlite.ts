import Database from 'better-sqlite3';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { log } from '../utils/logger.js';

const USER_DATA_DIR = path.join(os.homedir(), '.skills-manager');

function resolveDbPath(): string {
  return process.env.SM_DB_PATH || path.join(USER_DATA_DIR, 'db.sqlite');
}

let dbInstance: Database.Database | null = null;
let dbPath: string | null = null;
let migrationDone = false;

function ensureSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id TEXT PRIMARY KEY,
      skill_path TEXT NOT NULL,
      skill_name TEXT NOT NULL,
      event_type TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      metadata TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_analytics_skill_path ON analytics_events(skill_path);
    CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics_events(timestamp);

    CREATE TABLE IF NOT EXISTS feedback_events (
      id TEXT PRIMARY KEY,
      skill_path TEXT NOT NULL,
      skill_name TEXT NOT NULL,
      feedback_type TEXT NOT NULL,
      scenario TEXT NOT NULL,
      comment TEXT,
      tool_used TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      metadata TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_feedback_skill_path ON feedback_events(skill_path);
    CREATE INDEX IF NOT EXISTS idx_feedback_timestamp ON feedback_events(timestamp);

    -- usage_stats: keyed by skill_name (display name). Concurrent
    -- POST /api/radar/usage/increment must be safe — INSERT...ON CONFLICT.
    CREATE TABLE IF NOT EXISTS usage_stats (
      skill_name TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0,
      last_used_at TEXT NOT NULL
    );

    -- rubric_cache: keyed by skill_name. Stores latest score/grade snapshot.
    CREATE TABLE IF NOT EXISTS rubric_cache (
      skill_name TEXT PRIMARY KEY,
      grade TEXT NOT NULL,
      score INTEGER NOT NULL,
      evaluated_at TEXT NOT NULL
    );
  `);
}

export function getDb(): Database.Database {
  const expectedPath = resolveDbPath();
  if (dbInstance && dbPath === expectedPath) return dbInstance;
  if (dbInstance && dbPath !== expectedPath) {
    closeDb();
  }
  fs.ensureDirSync(path.dirname(expectedPath));
  const db = new Database(expectedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  ensureSchema(db);
  dbInstance = db;
  dbPath = expectedPath;
  return db;
}

export function closeDb(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore
    }
    dbInstance = null;
    dbPath = null;
  }
}

interface MigrationLine {
  type: 'analytics' | 'feedback';
  data: Record<string, unknown>;
}

async function importJsonl<T>(filePath: string): Promise<T[]> {
  if (!await fs.pathExists(filePath)) return [];
  const raw = await fs.readFile(filePath, 'utf-8');
  const lines = raw.trim().split('\n').filter(Boolean);
  const out: T[] = [];
  for (const line of lines) {
    try {
      out.push(JSON.parse(line) as T);
    } catch {
      // skip malformed line
    }
  }
  return out;
}

export async function migrateLegacyJsonl(): Promise<void> {
  if (migrationDone) return;
  migrationDone = true;

  const db = getDb();

  const analyticsCount = (db.prepare('SELECT COUNT(*) as c FROM analytics_events').get() as { c: number }).c;
  const feedbackCount = (db.prepare('SELECT COUNT(*) as c FROM feedback_events').get() as { c: number }).c;

  const analyticsPath = path.join(USER_DATA_DIR, 'analytics', 'events.jsonl');
  const feedbackPath = path.join(USER_DATA_DIR, 'feedback.jsonl');

  if (analyticsCount === 0 && (await fs.pathExists(analyticsPath))) {
    type LegacyEvent = {
      id: string; skillPath: string; skillName: string; eventType: string;
      timestamp: string; metadata?: Record<string, string>;
    };
    const events = await importJsonl<LegacyEvent>(analyticsPath);
    if (events.length > 0) {
      const insert = db.prepare(
        'INSERT OR IGNORE INTO analytics_events (id, skill_path, skill_name, event_type, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?)'
      );
      const tx = db.transaction((rows: LegacyEvent[]) => {
        for (const e of rows) {
          insert.run(
            e.id,
            e.skillPath,
            e.skillName,
            e.eventType,
            e.timestamp,
            e.metadata ? JSON.stringify(e.metadata) : null
          );
        }
      });
      tx(events);
      log.info(`[sqlite] Imported ${events.length} analytics events from JSONL`);
    }
    await fs.rename(analyticsPath, `${analyticsPath}.bak-${Date.now()}`).catch(() => {});
  }

  // One-shot migration: legacy ~/.skills-manager/usage-stats.json and
  // rubric-cache.json → SQLite tables. Idempotent (skipped if tables non-empty).
  const usagePath = path.join(USER_DATA_DIR, 'usage-stats.json');
  const rubricCachePath = path.join(USER_DATA_DIR, 'rubric-cache.json');
  const usageCount = (db.prepare('SELECT COUNT(*) as c FROM usage_stats').get() as { c: number }).c;
  const rubricCount = (db.prepare('SELECT COUNT(*) as c FROM rubric_cache').get() as { c: number }).c;

  if (usageCount === 0 && (await fs.pathExists(usagePath))) {
    try {
      const data = (await fs.readJson(usagePath)) as Record<string, number>;
      const entries = Object.entries(data).filter(([k, v]) => typeof k === 'string' && typeof v === 'number');
      if (entries.length > 0) {
        const insert = db.prepare(
          'INSERT OR IGNORE INTO usage_stats (skill_name, count, last_used_at) VALUES (?, ?, ?)'
        );
        const now = new Date().toISOString();
        const tx = db.transaction((rows: [string, number][]) => {
          for (const [name, count] of rows) {
            insert.run(name, count, now);
          }
        });
        tx(entries);
        log.info(`[sqlite] Imported ${entries.length} usage_stats from JSON`);
      }
      await fs.rename(usagePath, `${usagePath}.bak-${Date.now()}`).catch(() => {});
    } catch (err) {
      log.warn({ err }, '[sqlite] usage-stats.json migration failed; leaving file in place');
    }
  }

  if (rubricCount === 0 && (await fs.pathExists(rubricCachePath))) {
    try {
      type LegacyRubric = { grade: string; score: number; evaluatedAt: string };
      const data = (await fs.readJson(rubricCachePath)) as Record<string, LegacyRubric>;
      const entries = Object.entries(data).filter(
        ([, v]) => v && typeof v.grade === 'string' && typeof v.score === 'number' && typeof v.evaluatedAt === 'string'
      );
      if (entries.length > 0) {
        const insert = db.prepare(
          'INSERT OR IGNORE INTO rubric_cache (skill_name, grade, score, evaluated_at) VALUES (?, ?, ?, ?)'
        );
        const tx = db.transaction((rows: [string, LegacyRubric][]) => {
          for (const [name, entry] of rows) {
            insert.run(name, entry.grade, Math.round(entry.score), entry.evaluatedAt);
          }
        });
        tx(entries);
        log.info(`[sqlite] Imported ${entries.length} rubric_cache from JSON`);
      }
      await fs.rename(rubricCachePath, `${rubricCachePath}.bak-${Date.now()}`).catch(() => {});
    } catch (err) {
      log.warn({ err }, '[sqlite] rubric-cache.json migration failed; leaving file in place');
    }
  }

  if (feedbackCount === 0 && (await fs.pathExists(feedbackPath))) {
    type LegacyFeedback = {
      id: string; skillPath: string; skillName: string; feedbackType: string;
      scenario: string; comment?: string; toolUsed: string; timestamp: string;
      metadata?: Record<string, string>;
    };
    const entries = await importJsonl<LegacyFeedback>(feedbackPath);
    if (entries.length > 0) {
      const insert = db.prepare(
        'INSERT OR IGNORE INTO feedback_events (id, skill_path, skill_name, feedback_type, scenario, comment, tool_used, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      const tx = db.transaction((rows: LegacyFeedback[]) => {
        for (const e of rows) {
          insert.run(
            e.id,
            e.skillPath,
            e.skillName,
            e.feedbackType,
            e.scenario,
            e.comment ?? null,
            e.toolUsed,
            e.timestamp,
            e.metadata ? JSON.stringify(e.metadata) : null
          );
        }
      });
      tx(entries);
      log.info(`[sqlite] Imported ${entries.length} feedback entries from JSONL`);
    }
    await fs.rename(feedbackPath, `${feedbackPath}.bak-${Date.now()}`).catch(() => {});
  }
}

// Used in tests to reset state
export function _resetForTests(): void {
  closeDb();
  migrationDone = false;
}
