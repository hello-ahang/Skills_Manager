import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/sqlite.js';
import { safeParseJsonRecord } from '../utils/json.js';

// ==================== Types ====================

export type FeedbackType = 'effective' | 'ineffective' | 'partial' | 'suggestion';

export interface SkillFeedback {
  id: string;
  skillName: string;
  skillPath: string;
  feedbackType: FeedbackType;
  scenario: string;
  comment?: string;
  toolUsed: string;
  timestamp: string;
  metadata?: Record<string, string>;
}

export interface FeedbackStats {
  skillName: string;
  skillPath: string;
  total: number;
  effective: number;
  ineffective: number;
  partial: number;
  suggestion: number;
  effectiveRate: number;
  lastFeedbackAt?: string;
}

const MAX_AGE_DAYS = 180;

interface DbFeedbackRow {
  id: string;
  skill_path: string;
  skill_name: string;
  feedback_type: string;
  scenario: string;
  comment: string | null;
  tool_used: string;
  timestamp: string;
  metadata: string | null;
}

function rowToFeedback(row: DbFeedbackRow): SkillFeedback {
  return {
    id: row.id,
    skillPath: row.skill_path,
    skillName: row.skill_name,
    feedbackType: row.feedback_type as FeedbackType,
    scenario: row.scenario,
    comment: row.comment ?? undefined,
    toolUsed: row.tool_used,
    timestamp: row.timestamp,
    metadata: row.metadata ? safeParseJsonRecord(row.metadata) : undefined,
  };
}

// Day-grained guard so the DELETE doesn't run on every read.
const AUTO_CLEAN_INTERVAL_MS = 24 * 60 * 60 * 1000;
let lastAutoCleanAt = 0;
function autoClean(): void {
  if (Date.now() - lastAutoCleanAt < AUTO_CLEAN_INTERVAL_MS) return;
  lastAutoCleanAt = Date.now();
  const db = getDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);
  db.prepare('DELETE FROM feedback_events WHERE timestamp < ?').run(cutoff.toISOString());
}

// ==================== Public API ====================

export async function submitFeedback(
  input: Omit<SkillFeedback, 'id' | 'timestamp'>
): Promise<SkillFeedback> {
  const db = getDb();
  const entry: SkillFeedback = {
    id: uuidv4(),
    ...input,
    timestamp: new Date().toISOString(),
  };
  db.prepare(
    'INSERT INTO feedback_events (id, skill_path, skill_name, feedback_type, scenario, comment, tool_used, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    entry.id,
    entry.skillPath,
    entry.skillName,
    entry.feedbackType,
    entry.scenario,
    entry.comment ?? null,
    entry.toolUsed,
    entry.timestamp,
    entry.metadata ? JSON.stringify(entry.metadata) : null
  );
  return entry;
}

export async function getFeedback(skillPath?: string): Promise<SkillFeedback[]> {
  autoClean();
  const db = getDb();
  const rows = skillPath
    ? db.prepare('SELECT * FROM feedback_events WHERE skill_path = ? ORDER BY timestamp DESC').all(skillPath) as DbFeedbackRow[]
    : db.prepare('SELECT * FROM feedback_events ORDER BY timestamp DESC').all() as DbFeedbackRow[];
  return rows.map(rowToFeedback);
}

export async function getFeedbackStats(): Promise<FeedbackStats[]> {
  autoClean();
  const db = getDb();
  const rows = db.prepare('SELECT * FROM feedback_events').all() as DbFeedbackRow[];
  const statsMap = new Map<string, FeedbackStats>();

  for (const row of rows) {
    const key = row.skill_path;
    if (!statsMap.has(key)) {
      statsMap.set(key, {
        skillName: row.skill_name,
        skillPath: row.skill_path,
        total: 0,
        effective: 0,
        ineffective: 0,
        partial: 0,
        suggestion: 0,
        effectiveRate: 0,
      });
    }
    const stats = statsMap.get(key)!;
    stats.total++;
    const type = row.feedback_type as FeedbackType;
    if (type === 'effective' || type === 'ineffective' || type === 'partial' || type === 'suggestion') {
      stats[type]++;
    }
    if (!stats.lastFeedbackAt || row.timestamp > stats.lastFeedbackAt) {
      stats.lastFeedbackAt = row.timestamp;
    }
  }

  for (const stats of statsMap.values()) {
    const ratable = stats.effective + stats.ineffective + stats.partial;
    stats.effectiveRate = ratable > 0
      ? Math.round((stats.effective / ratable) * 100)
      : 0;
  }

  return Array.from(statsMap.values()).sort((a, b) => b.total - a.total);
}

export async function deleteFeedback(id: string): Promise<boolean> {
  const db = getDb();
  const result = db.prepare('DELETE FROM feedback_events WHERE id = ?').run(id);
  return result.changes > 0;
}

export async function clearAllFeedback(): Promise<void> {
  const db = getDb();
  db.prepare('DELETE FROM feedback_events').run();
}
