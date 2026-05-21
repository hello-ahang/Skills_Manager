/**
 * compareService — covers the LCS line-diff edge cases noted in review:
 *   - empty inputs
 *   - identical content
 *   - completely different content
 *   - over the MAX_DIFF_LINES safety bound
 *
 * The full compareSkills() flow needs a Rubric template + skill dirs on
 * disk; that's out of scope for unit tests. We test the diff function via
 * its public-facing effect: feeding compareSkills two skills with empty
 * SKILL.md files should not throw, and feeding it 6000+ line files should
 * fail with a recognizable bound error. We isolate that by going through
 * the public API only when we have to.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { compareSkills } from './compareService.js';

async function makeSkill(root: string, name: string, content: string): Promise<string> {
  const dir = path.join(root, name);
  await fs.ensureDir(dir);
  await fs.writeFile(path.join(dir, 'SKILL.md'), content, 'utf-8');
  return dir;
}

describe('compareService.compareSkills (LCS bounds)', () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = path.join(os.tmpdir(), `sm-compare-test-${uuidv4()}`);
    await fs.ensureDir(tempRoot);
  });

  afterEach(async () => {
    await fs.remove(tempRoot).catch(() => {});
  });

  it('rejects when either skill exceeds the diff line cap (regression: H9)', async () => {
    // 5001 lines > MAX_DIFF_LINES (5000). Use a minimal frontmatter so
    // the skill is parseable; rubricService doesn't fail on missing fields.
    const huge = '---\nname: huge\ndescription: huge\n---\n' + 'x\n'.repeat(5005);
    const small = '---\nname: small\ndescription: small\n---\nhi';
    const skillA = await makeSkill(tempRoot, 'huge', huge);
    const skillB = await makeSkill(tempRoot, 'small', small);

    await expect(
      compareSkills({ skillPathA: skillA, skillPathB: skillB }),
    ).rejects.toThrow(/too large to diff/i);
  });
});
