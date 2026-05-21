/**
 * SQL injection static check — locks the parameterization invariant
 * in place. All `db.prepare(...)` calls must use static strings (no
 * template literals with `${...}` interpolation) so that user-controlled
 * values reach SQLite only via `.run(?, ?, ...)` placeholders.
 *
 * If this test fails, someone wrote `db.prepare(\`SELECT ... WHERE x = ${x}\`)`
 * — that's a SQL injection. Fix by using a placeholder + .run(x).
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_DIR = path.resolve(__dirname, '..');

async function listTsFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listTsFiles(full)));
    } else if (entry.isFile() && full.endsWith('.ts') && !full.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('SQL parameterization (regression)', () => {
  it('no db.prepare(...) uses template literals with ${...} interpolation', async () => {
    const files = await listTsFiles(SERVER_DIR);
    const offenders: { file: string; line: number; snippet: string }[] = [];

    // Match `db.prepare(` or `getDb().prepare(` followed by a backtick string
    // that contains ${. The test deliberately accepts plain strings (single
    // quote, double quote, or backtick without ${) — those are safe.
    const offenderRe = /\bprepare\s*\(\s*`[^`]*\$\{[^`]*`/;

    for (const file of files) {
      const text = await fs.readFile(file, 'utf-8');
      const lines = text.split('\n');
      lines.forEach((line, i) => {
        if (offenderRe.test(line)) {
          offenders.push({ file: path.relative(SERVER_DIR, file), line: i + 1, snippet: line.trim() });
        }
      });
    }

    if (offenders.length > 0) {
      const detail = offenders
        .map(o => `  ${o.file}:${o.line}\n    ${o.snippet}`)
        .join('\n');
      throw new Error(
        `Found ${offenders.length} db.prepare() call(s) with template literal interpolation — this is a SQL injection vector. Use ? placeholders + .run(arg) instead:\n${detail}`,
      );
    }

    expect(offenders).toEqual([]);
  });
});
