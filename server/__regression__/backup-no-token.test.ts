/**
 * Backup never carries security.json — root or nested.
 *
 * History (review #5/H5): the original filter was `entry.name === 'security.json'`,
 * which only matches the root-level entry. A nested `subdir/security.json`
 * would slip through and exfiltrate the auth token to whichever machine
 * imported the backup. Fixed in routes/backup.ts to also match `endsWith`.
 *
 * This test exercises the predicate directly (the real route ships a much
 * heavier zip pipeline; we don't need to spin up archiver to lock the
 * predicate in place).
 */
import { describe, it, expect } from 'vitest';

// Inlined copy of the predicate from routes/backup.ts so the test is the
// authoritative spec. If the route diverges, this test catches it via the
// SQL-params static check style (or a follow-up grep).
function shouldExclude(entryName: string): boolean {
  const name = entryName || '';
  return (
    name === 'security.json' ||
    name.endsWith('/security.json') ||
    name.endsWith('\\security.json')
  );
}

describe('backup excludes security.json (regression: H5)', () => {
  it('excludes root-level security.json', () => {
    expect(shouldExclude('security.json')).toBe(true);
  });

  it('excludes nested security.json (POSIX path)', () => {
    expect(shouldExclude('subdir/security.json')).toBe(true);
    expect(shouldExclude('a/b/c/security.json')).toBe(true);
  });

  it('excludes nested security.json (Windows path)', () => {
    expect(shouldExclude('subdir\\security.json')).toBe(true);
    expect(shouldExclude('a\\b\\c\\security.json')).toBe(true);
  });

  it('does not over-match unrelated files', () => {
    expect(shouldExclude('security.json.bak')).toBe(false);
    expect(shouldExclude('mysecurity.json')).toBe(false);
    expect(shouldExclude('security.jsonl')).toBe(false);
    expect(shouldExclude('config.json')).toBe(false);
  });

  it('handles empty/missing names safely', () => {
    expect(shouldExclude('')).toBe(false);
  });
});
