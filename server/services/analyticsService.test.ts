import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { _resetForTests, getDb } from '../db/sqlite.js';
import { recordEvent, getRecentActivity, clearAll } from './analyticsService.js';

const TEST_DB_DIR = path.join(os.tmpdir(), `sm-analytics-test-${uuidv4()}`);
const TEST_DB_PATH = path.join(TEST_DB_DIR, 'test.sqlite');

beforeAll(async () => {
  process.env.SM_DB_PATH = TEST_DB_PATH;
  await fs.ensureDir(TEST_DB_DIR);
  _resetForTests();
});

afterAll(async () => {
  _resetForTests();
  delete process.env.SM_DB_PATH;
  await fs.remove(TEST_DB_DIR).catch(() => {});
});

beforeEach(async () => {
  // Reset DB for each test
  const db = getDb();
  db.prepare('DELETE FROM analytics_events').run();
});

describe('analyticsService', () => {
  it('records and reads events', async () => {
    await recordEvent('/skills/foo', 'foo', 'view');
    await recordEvent('/skills/foo', 'foo', 'edit');
    const recent = await getRecentActivity(10);
    expect(recent.length).toBe(2);
    expect(recent[0].skillName).toBe('foo');
  });

  it('handles 100 concurrent recordEvent calls without loss or corruption', async () => {
    const skillPath = '/test/concurrent-skill';
    const promises: Promise<void>[] = [];
    for (let i = 0; i < 100; i++) {
      promises.push(recordEvent(skillPath, 'concurrent', 'view', { i: String(i) }));
    }
    await Promise.all(promises);

    const recent = await getRecentActivity(200);
    const filtered = recent.filter(e => e.skillPath === skillPath);
    expect(filtered.length).toBe(100);

    // Verify metadata round-trip survives JSON encoding
    const indexes = filtered
      .map(e => e.metadata?.i)
      .filter((v): v is string => typeof v === 'string')
      .map(Number);
    const unique = new Set(indexes);
    expect(unique.size).toBe(100);
  });

  it('clearAll removes all events', async () => {
    await recordEvent('/skills/bar', 'bar', 'view');
    await clearAll();
    const recent = await getRecentActivity(10);
    expect(recent.length).toBe(0);
  });
});
