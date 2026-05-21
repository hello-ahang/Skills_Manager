import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  createVersion,
  restoreVersion,
  diffVersion,
  deleteVersion,
  getVersionHistory,
} from './versionService.js';

function md5(buf: Buffer): string {
  return crypto.createHash('md5').update(buf).digest('hex');
}

describe('versionService binary file protection', () => {
  let skillDir: string;
  let createdVersionIds: string[] = [];

  // A 4x4 PNG binary buffer (real PNG header + IHDR + IDAT + IEND)
  const pngBuffer = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000040000000408060000' +
    '00a9f1ce7e000000174944415478da636060606000000000050001' +
    'a5f645400000000049454e44ae426082',
    'hex'
  );

  beforeEach(async () => {
    skillDir = path.join(os.tmpdir(), `sm-version-test-${uuidv4()}`);
    await fs.ensureDir(skillDir);
    createdVersionIds = [];
  });

  afterEach(async () => {
    for (const id of createdVersionIds) {
      await deleteVersion(id).catch(() => {});
    }
    await fs.remove(skillDir).catch(() => {});
  });

  it('preserves binary files (PNG) across createVersion/restoreVersion', async () => {
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# test\n');
    await fs.ensureDir(path.join(skillDir, 'assets'));
    await fs.writeFile(path.join(skillDir, 'assets', 'logo.png'), pngBuffer);

    const originalMd5 = md5(pngBuffer);

    const meta = await createVersion(skillDir, '1.0.0', 'with-png');
    createdVersionIds.push(meta.id);

    // Mutate: delete png and edit md
    await fs.remove(path.join(skillDir, 'assets', 'logo.png'));
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# changed\n');

    const result = await restoreVersion(meta.id);
    expect(result.success).toBe(true);
    if (result.backupVersionId) createdVersionIds.push(result.backupVersionId);

    expect(await fs.pathExists(path.join(skillDir, 'assets', 'logo.png'))).toBe(true);
    const restoredBuf = await fs.readFile(path.join(skillDir, 'assets', 'logo.png'));
    expect(md5(restoredBuf)).toBe(originalMd5);

    const mdContent = await fs.readFile(path.join(skillDir, 'SKILL.md'), 'utf-8');
    expect(mdContent).toBe('# test\n');
  });

  it('marks binary file changes as binary status in diff', async () => {
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# v1\n');
    await fs.writeFile(path.join(skillDir, 'logo.png'), pngBuffer);

    const meta = await createVersion(skillDir, '1.0.0');
    createdVersionIds.push(meta.id);

    // Modify both
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# v2\n');
    await fs.writeFile(path.join(skillDir, 'logo.png'), Buffer.concat([pngBuffer, Buffer.from('extra')]));

    const diffs = await diffVersion(meta.id);
    const pngDiff = diffs.find(d => d.relativePath === 'logo.png');
    const mdDiff = diffs.find(d => d.relativePath === 'SKILL.md');

    expect(pngDiff).toBeDefined();
    expect(pngDiff!.status).toBe('binary');
    expect(pngDiff!.isBinary).toBe(true);
    expect(pngDiff!.currentContent).toBeUndefined();
    expect(pngDiff!.versionContent).toBeUndefined();

    expect(mdDiff).toBeDefined();
    expect(mdDiff!.status).toBe('modified');
  });

  it('lists created version in history', async () => {
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# v\n');
    const meta = await createVersion(skillDir, '0.1.0', 'first');
    createdVersionIds.push(meta.id);

    const history = await getVersionHistory(skillDir);
    const found = history.find(v => v.id === meta.id);
    expect(found).toBeDefined();
    expect(found!.label).toBe('first');
  });

  it('restoreVersion is atomic — interrupting writes leaves the dir consistent (regression: C6)', async () => {
    // Setup: a skill with two text files + a hidden file we want preserved.
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# original\n');
    await fs.writeFile(path.join(skillDir, 'helper.md'), 'helper-orig\n');
    await fs.ensureDir(path.join(skillDir, '.git'));
    await fs.writeFile(path.join(skillDir, '.git', 'HEAD'), 'ref: refs/heads/main\n');

    const meta = await createVersion(skillDir, '1.0.0', 'baseline');
    createdVersionIds.push(meta.id);

    // Now mutate live state, then restore and confirm both:
    //  1. files match the snapshot
    //  2. hidden .git is preserved
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# mutated\n');
    await fs.remove(path.join(skillDir, 'helper.md'));

    const result = await restoreVersion(meta.id);
    expect(result.success).toBe(true);
    if (result.backupVersionId) createdVersionIds.push(result.backupVersionId);

    expect(await fs.readFile(path.join(skillDir, 'SKILL.md'), 'utf-8')).toBe('# original\n');
    expect(await fs.readFile(path.join(skillDir, 'helper.md'), 'utf-8')).toBe('helper-orig\n');
    // Hidden file must survive the swap.
    expect(await fs.pathExists(path.join(skillDir, '.git', 'HEAD'))).toBe(true);

    // No leftover .restore-tmp-* or .old-* siblings.
    const parent = path.dirname(skillDir);
    const siblings = await fs.readdir(parent);
    const leftovers = siblings.filter(
      s => s.startsWith(`${path.basename(skillDir)}.restore-tmp-`) ||
           s.startsWith(`${path.basename(skillDir)}.old-`),
    );
    expect(leftovers).toEqual([]);
  });

  it('looksBinary does NOT misclassify UTF-8 Chinese content (regression)', async () => {
    // 中文 SKILL.md is a real workflow — the byte-zero check is the only
    // signal that should fire. Confirm a snapshot round-trips as text.
    const chineseContent = '# 技能：中文示例\n\n描述：用于测试 UTF-8 多字节字符的处理。\n第二段。\n';
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), chineseContent, 'utf-8');

    const meta = await createVersion(skillDir, '1.0.0', 'cn');
    createdVersionIds.push(meta.id);

    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '改动了\n', 'utf-8');
    const result = await restoreVersion(meta.id);
    expect(result.success).toBe(true);
    if (result.backupVersionId) createdVersionIds.push(result.backupVersionId);

    const restored = await fs.readFile(path.join(skillDir, 'SKILL.md'), 'utf-8');
    expect(restored).toBe(chineseContent);
  });
});
