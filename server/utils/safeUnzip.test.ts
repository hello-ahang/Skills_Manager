import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';
import { safeUnzipFile, isInsideRoot, SAFE_UNZIP_LIMITS } from './safeUnzip.js';

interface ZipEntrySpec {
  name: string;
  content: string;
}

async function buildZip(entries: ZipEntrySpec[], targetPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const out = fs.createWriteStream(targetPath);
    const archive = archiver('zip', { zlib: { level: 1 } });
    out.on('close', () => resolve());
    archive.on('error', reject);
    archive.pipe(out);
    for (const entry of entries) {
      archive.append(entry.content, { name: entry.name });
    }
    archive.finalize();
  });
}

describe('isInsideRoot (ZipSlip core check)', () => {
  const root = path.join(os.tmpdir(), 'sm-zipslip-root');

  it('accepts safe paths', () => {
    expect(isInsideRoot(path.join(root, 'a.txt'), root)).toBe(true);
    expect(isInsideRoot(path.join(root, 'a', 'b.txt'), root)).toBe(true);
  });

  it('rejects ../ traversal', () => {
    expect(isInsideRoot(path.join(root, '..', 'evil.txt'), root)).toBe(false);
  });

  it('rejects deep traversal', () => {
    expect(isInsideRoot(path.join(root, '..', '..', 'evil.txt'), root)).toBe(false);
  });

  it('rejects absolute paths outside root', () => {
    expect(isInsideRoot('/etc/passwd', root)).toBe(false);
  });
});

describe('safeUnzipFile', () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = path.join(os.tmpdir(), `sm-unzip-test-${uuidv4()}`);
    await fs.ensureDir(tempRoot);
  });

  afterEach(async () => {
    await fs.remove(tempRoot).catch(() => {});
  });

  it('extracts safe entries to the target dir', async () => {
    const zipPath = path.join(tempRoot, 'safe.zip');
    const extractDir = path.join(tempRoot, 'out');
    await buildZip([
      { name: 'a.txt', content: 'hello' },
      { name: 'sub/b.txt', content: 'world' },
    ], zipPath);

    const result = await safeUnzipFile(zipPath, extractDir);

    expect(result.skipped.length).toBe(0);
    expect(await fs.readFile(path.join(extractDir, 'a.txt'), 'utf-8')).toBe('hello');
    expect(await fs.readFile(path.join(extractDir, 'sub', 'b.txt'), 'utf-8')).toBe('world');
  });

  it('does not write outside extract dir for archiver-normalized names', async () => {
    // archiver 自动 normalize "../" 前缀，最终 entry 仍在 extractDir 内
    // 这个测试验证常规情况下解压不会逃出目录
    const zipPath = path.join(tempRoot, 'normalized.zip');
    const extractDir = path.join(tempRoot, 'out2');
    const outsideTarget = path.join(tempRoot, 'outside-evil.txt');

    await buildZip([
      { name: '../outside-evil.txt', content: 'pwned' },
    ], zipPath);

    await safeUnzipFile(zipPath, extractDir);

    // 即使 archiver normalize 了，攻击者文件也不应该跑到 extractDir 之外
    expect(await fs.pathExists(outsideTarget)).toBe(false);
  });

  it('exposes safe limit constants (regression: limits documented)', () => {
    // Locks the limit values so a future "let's just bump 10x for that one
    // user" change has to update the test in plain sight.
    expect(SAFE_UNZIP_LIMITS.maxEntries).toBe(50_000);
    expect(SAFE_UNZIP_LIMITS.maxTotalUncompressedBytes).toBe(2 * 1024 * 1024 * 1024);
    expect(SAFE_UNZIP_LIMITS.maxSingleEntryBytes).toBe(1 * 1024 * 1024 * 1024);
  });

  it('aborts when entry count exceeds maxEntries (regression: zip bomb)', async () => {
    const zipPath = path.join(tempRoot, 'too-many.zip');
    const extractDir = path.join(tempRoot, 'tm-out');
    await buildZip(
      Array.from({ length: 10 }, (_, i) => ({ name: `f${i}.txt`, content: 'x' })),
      zipPath,
    );
    await expect(
      safeUnzipFile(zipPath, extractDir, {
        maxEntries: 3,
        maxTotalUncompressedBytes: SAFE_UNZIP_LIMITS.maxTotalUncompressedBytes,
        maxSingleEntryBytes: SAFE_UNZIP_LIMITS.maxSingleEntryBytes,
      }),
    ).rejects.toThrow(/entry count exceeds safe limit/i);
  });

  it('aborts when total uncompressed size exceeds limit (regression: zip bomb)', async () => {
    const zipPath = path.join(tempRoot, 'too-big.zip');
    const extractDir = path.join(tempRoot, 'big-out');
    // 10 files × 100 bytes = 1000 bytes total; tiny limit at 200 bytes.
    await buildZip(
      Array.from({ length: 10 }, (_, i) => ({ name: `b${i}.txt`, content: 'x'.repeat(100) })),
      zipPath,
    );
    await expect(
      safeUnzipFile(zipPath, extractDir, {
        maxEntries: SAFE_UNZIP_LIMITS.maxEntries,
        maxTotalUncompressedBytes: 200,
        maxSingleEntryBytes: SAFE_UNZIP_LIMITS.maxSingleEntryBytes,
      }),
    ).rejects.toThrow(/total uncompressed size exceeds safe limit/i);
  });

  it('aborts when single entry exceeds limit (regression: zip bomb)', async () => {
    const zipPath = path.join(tempRoot, 'big-entry.zip');
    const extractDir = path.join(tempRoot, 'be-out');
    await buildZip(
      [{ name: 'huge.txt', content: 'y'.repeat(2000) }],
      zipPath,
    );
    await expect(
      safeUnzipFile(zipPath, extractDir, {
        maxEntries: SAFE_UNZIP_LIMITS.maxEntries,
        maxTotalUncompressedBytes: SAFE_UNZIP_LIMITS.maxTotalUncompressedBytes,
        maxSingleEntryBytes: 500,
      }),
    ).rejects.toThrow(/single-file size limit/i);
  });
});
