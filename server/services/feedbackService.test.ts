/**
 * feedbackService — round-trip + stats aggregation + delete behavior.
 * Uses SM_DB_PATH override + _resetForTests so each spec starts with a
 * clean SQLite file under /tmp.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

let dbPath: string;
let originalEnv: string | undefined;

beforeEach(async () => {
  dbPath = path.join(os.tmpdir(), `sm-feedback-${uuidv4()}.sqlite`);
  originalEnv = process.env.SM_DB_PATH;
  process.env.SM_DB_PATH = dbPath;
  // Re-import the modules so the new SM_DB_PATH is read.
  const { _resetForTests } = await import('../db/sqlite.js');
  _resetForTests();
});

afterEach(async () => {
  const { _resetForTests } = await import('../db/sqlite.js');
  _resetForTests();
  if (originalEnv === undefined) delete process.env.SM_DB_PATH;
  else process.env.SM_DB_PATH = originalEnv;
  await fs.remove(dbPath).catch(() => {});
});

describe('feedbackService round-trip', () => {
  it('submitFeedback → getFeedback returns the same entry', async () => {
    const { submitFeedback, getFeedback } = await import('./feedbackService.js');
    const entry = await submitFeedback({
      skillName: 'demo',
      skillPath: '/tmp/demo',
      feedbackType: 'effective',
      scenario: 'unit-test',
      comment: 'works',
      toolUsed: 'claude',
    });
    const list = await getFeedback('/tmp/demo');
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(entry.id);
    expect(list[0].comment).toBe('works');
    expect(list[0].feedbackType).toBe('effective');
  });

  it('getFeedback filters by skillPath', async () => {
    const { submitFeedback, getFeedback } = await import('./feedbackService.js');
    await submitFeedback({
      skillName: 'a', skillPath: '/tmp/a', feedbackType: 'effective', scenario: 's', toolUsed: 't',
    });
    await submitFeedback({
      skillName: 'b', skillPath: '/tmp/b', feedbackType: 'partial', scenario: 's', toolUsed: 't',
    });
    const aOnly = await getFeedback('/tmp/a');
    expect(aOnly).toHaveLength(1);
    expect(aOnly[0].skillName).toBe('a');
  });

  it('deleteFeedback removes only the targeted row', async () => {
    const { submitFeedback, deleteFeedback, getFeedback } = await import('./feedbackService.js');
    const a = await submitFeedback({
      skillName: 'a', skillPath: '/tmp/a', feedbackType: 'effective', scenario: 's', toolUsed: 't',
    });
    await submitFeedback({
      skillName: 'a', skillPath: '/tmp/a', feedbackType: 'partial', scenario: 's', toolUsed: 't',
    });
    const ok = await deleteFeedback(a.id);
    expect(ok).toBe(true);
    const remaining = await getFeedback('/tmp/a');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).not.toBe(a.id);
  });
});

describe('feedbackService stats aggregation', () => {
  it('aggregates per-skill counts and effectiveRate', async () => {
    const { submitFeedback, getFeedbackStats } = await import('./feedbackService.js');
    // 3 effective + 1 ineffective + 1 partial + 1 suggestion → ratable = 5,
    // effective/ratable = 3/5 = 60%.
    await submitFeedback({ skillName: 'x', skillPath: '/tmp/x', feedbackType: 'effective', scenario: 's', toolUsed: 't' });
    await submitFeedback({ skillName: 'x', skillPath: '/tmp/x', feedbackType: 'effective', scenario: 's', toolUsed: 't' });
    await submitFeedback({ skillName: 'x', skillPath: '/tmp/x', feedbackType: 'effective', scenario: 's', toolUsed: 't' });
    await submitFeedback({ skillName: 'x', skillPath: '/tmp/x', feedbackType: 'ineffective', scenario: 's', toolUsed: 't' });
    await submitFeedback({ skillName: 'x', skillPath: '/tmp/x', feedbackType: 'partial', scenario: 's', toolUsed: 't' });
    await submitFeedback({ skillName: 'x', skillPath: '/tmp/x', feedbackType: 'suggestion', scenario: 's', toolUsed: 't' });

    const stats = await getFeedbackStats();
    expect(stats).toHaveLength(1);
    const s = stats[0];
    expect(s.total).toBe(6);
    expect(s.effective).toBe(3);
    expect(s.ineffective).toBe(1);
    expect(s.partial).toBe(1);
    expect(s.suggestion).toBe(1);
    expect(s.effectiveRate).toBe(60);
  });

  it('effectiveRate is 0 when no ratable entries (only suggestions)', async () => {
    const { submitFeedback, getFeedbackStats } = await import('./feedbackService.js');
    await submitFeedback({ skillName: 'y', skillPath: '/tmp/y', feedbackType: 'suggestion', scenario: 's', toolUsed: 't' });
    const stats = await getFeedbackStats();
    expect(stats[0].effectiveRate).toBe(0);
  });
});
