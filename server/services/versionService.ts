import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { SkillVersion, VersionFile, VersionDetail, VersionDiff } from '../../src/types/index.js';
import { atomicWriteJson } from '../utils/json.js';

const USER_CONFIG_DIR = path.join(os.homedir(), '.skills-manager');
const VERSIONS_DIR = path.join(USER_CONFIG_DIR, 'versions');
const INDEX_PATH = path.join(VERSIONS_DIR, 'index.json');
const SNAPSHOTS_DIR = path.join(VERSIONS_DIR, 'snapshots');

const MAX_VERSIONS_PER_SKILL = 20;

// ==================== Helpers ====================

async function ensureDirs(): Promise<void> {
  await fs.ensureDir(VERSIONS_DIR);
  await fs.ensureDir(SNAPSHOTS_DIR);
}

async function readIndex(): Promise<SkillVersion[]> {
  await ensureDirs();
  if (await fs.pathExists(INDEX_PATH)) {
    try {
      return await fs.readJson(INDEX_PATH);
    } catch {
      return [];
    }
  }
  return [];
}

async function writeIndex(versions: SkillVersion[]): Promise<void> {
  await ensureDirs();
  await atomicWriteJson(INDEX_PATH, versions);
}

function looksBinary(buffer: Buffer): boolean {
  const sampleSize = Math.min(buffer.length, 8000);
  for (let i = 0; i < sampleSize; i++) {
    if (buffer[i] === 0) return true;
  }
  // Best-effort: try strict utf-8 decode and re-encode, mismatch means binary
  try {
    const text = buffer.toString('utf-8');
    return Buffer.byteLength(text, 'utf-8') !== buffer.length;
  } catch {
    return true;
  }
}

/**
 * Recursively collect all files in a directory (relative paths + content).
 * Text files are stored as UTF-8 strings; binary files as base64.
 */
async function collectFiles(dirPath: string, basePath: string = dirPath): Promise<VersionFile[]> {
  const files: VersionFile[] = [];
  if (!await fs.pathExists(dirPath)) return files;

  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(basePath, fullPath);

    if (entry.isDirectory()) {
      const subFiles = await collectFiles(fullPath, basePath);
      files.push(...subFiles);
    } else {
      try {
        const buffer = await fs.readFile(fullPath);
        const stat = await fs.stat(fullPath);
        const binary = looksBinary(buffer);
        files.push({
          relativePath,
          content: binary ? buffer.toString('base64') : buffer.toString('utf-8'),
          size: stat.size,
          encoding: binary ? 'base64' : 'utf-8',
        });
      } catch {
        // Skip unreadable files
      }
    }
  }
  return files;
}

/**
 * Enforce max versions per skill — remove oldest versions if over limit.
 */
async function enforceLimit(versions: SkillVersion[], skillPath: string): Promise<SkillVersion[]> {
  const skillVersions = versions.filter(v => v.skillPath === skillPath);
  if (skillVersions.length <= MAX_VERSIONS_PER_SKILL) return versions;

  // Sort by createdAt ascending (oldest first)
  const sorted = [...skillVersions].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const toRemove = sorted.slice(0, skillVersions.length - MAX_VERSIONS_PER_SKILL);

  for (const v of toRemove) {
    const snapshotPath = path.join(SNAPSHOTS_DIR, `${v.id}.json`);
    await fs.remove(snapshotPath);
  }

  const removeIds = new Set(toRemove.map(v => v.id));
  return versions.filter(v => !removeIds.has(v.id));
}

// ==================== Public API ====================

/**
 * Get version history for a specific skill.
 */
export async function getVersionHistory(skillPath: string): Promise<SkillVersion[]> {
  const allVersions = await readIndex();
  return allVersions
    .filter(v => v.skillPath === skillPath)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Create a new version snapshot for a skill.
 */
export async function createVersion(
  skillPath: string,
  version: string,
  label?: string
): Promise<SkillVersion> {
  await ensureDirs();

  // Collect all files in the skill directory
  const files = await collectFiles(skillPath);
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  const id = uuidv4();
  const now = new Date().toISOString();

  const versionMeta: SkillVersion = {
    id,
    skillPath,
    version,
    label,
    createdAt: now,
    fileCount: files.length,
    totalSize,
  };

  // Save snapshot
  const detail: VersionDetail = {
    id,
    skillPath,
    version,
    label,
    createdAt: now,
    files,
  };
  await fs.writeJson(path.join(SNAPSHOTS_DIR, `${id}.json`), detail, { spaces: 2 });

  // Update index
  let allVersions = await readIndex();
  allVersions.push(versionMeta);

  // Enforce limit
  allVersions = await enforceLimit(allVersions, skillPath);

  await writeIndex(allVersions);

  return versionMeta;
}

/**
 * Get version detail (including file contents).
 */
export async function getVersionDetail(versionId: string): Promise<VersionDetail | null> {
  const snapshotPath = path.join(SNAPSHOTS_DIR, `${versionId}.json`);
  if (!await fs.pathExists(snapshotPath)) return null;

  try {
    return await fs.readJson(snapshotPath);
  } catch {
    return null;
  }
}

/**
 * Restore a version atomically.
 *
 * Sequence (each step verified before proceeding):
 *   1. Snapshot current state into a backup version (must succeed before we
 *      touch the user directory).
 *   2. Materialize the target snapshot into a sibling tmp dir
 *      `<skillPath>.restore-tmp-<ts>`.
 *   3. Move current dir aside to `<skillPath>.old-<ts>`.
 *   4. Rename tmp into place at `<skillPath>`.
 *   5. Remove the .old- directory once the swap is durable.
 *
 * On any failure after step 3, rename .old- back to recover the original.
 * Hidden files (anything starting with '.') in the original are preserved by
 * copying them into the tmp dir before the swap, mirroring the previous
 * behaviour where the loop skipped them when wiping.
 */
export async function restoreVersion(versionId: string): Promise<{ success: boolean; backupVersionId?: string }> {
  const detail = await getVersionDetail(versionId);
  if (!detail) {
    throw new Error('Version not found');
  }

  const { skillPath, files } = detail;

  if (!await fs.pathExists(skillPath)) {
    throw new Error(`Skill directory not found: ${skillPath}`);
  }

  // Step 1: backup. Failure here aborts before we touch anything.
  const backupVersion = await createVersion(skillPath, 'backup', '回滚前自动备份');

  const ts = Date.now();
  const tmpPath = `${skillPath}.restore-tmp-${process.pid}-${ts}`;
  const oldPath = `${skillPath}.old-${process.pid}-${ts}`;

  try {
    // Step 2: materialize snapshot into tmp dir.
    await fs.ensureDir(tmpPath);
    for (const file of files) {
      const targetPath = path.join(tmpPath, file.relativePath);
      await fs.ensureDir(path.dirname(targetPath));
      if (file.encoding === 'base64') {
        await fs.writeFile(targetPath, Buffer.from(file.content, 'base64'));
      } else {
        await fs.writeFile(targetPath, file.content, 'utf-8');
      }
    }

    // Preserve hidden files (.git, .skill-meta, etc.) from the live dir into tmp,
    // matching the prior wipe-loop's `startsWith('.')` skip.
    const existingEntries = await fs.readdir(skillPath, { withFileTypes: true });
    for (const entry of existingEntries) {
      if (!entry.name.startsWith('.')) continue;
      await fs.copy(path.join(skillPath, entry.name), path.join(tmpPath, entry.name));
    }

    // Step 3 + 4: atomic swap. On most filesystems both renames are O(1) and
    // crash-safe in the sense that either old or new is fully present, never
    // a half-merged state.
    await fs.rename(skillPath, oldPath);
    try {
      await fs.rename(tmpPath, skillPath);
    } catch (innerErr) {
      // Step 4 failed — roll the original back.
      await fs.rename(oldPath, skillPath).catch(() => {});
      throw innerErr;
    }

    // Step 5: cleanup. Best-effort; failures here don't roll back the restore.
    await fs.remove(oldPath).catch(() => {});

    return { success: true, backupVersionId: backupVersion.id };
  } catch (err) {
    // tmp may still exist if step 2 or 3 failed; sweep it.
    await fs.remove(tmpPath).catch(() => {});
    throw err;
  }
}

/**
 * Delete a version.
 */
export async function deleteVersion(versionId: string): Promise<void> {
  // Remove snapshot file
  const snapshotPath = path.join(SNAPSHOTS_DIR, `${versionId}.json`);
  await fs.remove(snapshotPath);

  // Update index
  let allVersions = await readIndex();
  allVersions = allVersions.filter(v => v.id !== versionId);
  await writeIndex(allVersions);
}

/**
 * Diff current files against a version snapshot.
 */
export async function diffVersion(versionId: string): Promise<VersionDiff[]> {
  const detail = await getVersionDetail(versionId);
  if (!detail) {
    throw new Error('Version not found');
  }

  const { skillPath, files: versionFiles } = detail;
  const diffs: VersionDiff[] = [];

  // Collect current files
  const currentFiles = await collectFiles(skillPath);
  const currentMap = new Map(currentFiles.map(f => [f.relativePath, f]));
  const versionMap = new Map(versionFiles.map(f => [f.relativePath, f]));

  for (const vf of versionFiles) {
    const cf = currentMap.get(vf.relativePath);
    const versionIsBinary = vf.encoding === 'base64';

    if (!cf) {
      diffs.push({
        relativePath: vf.relativePath,
        status: 'removed',
        versionContent: versionIsBinary ? undefined : vf.content,
        isBinary: versionIsBinary,
      });
      continue;
    }

    const currentIsBinary = cf.encoding === 'base64';
    const isBinary = versionIsBinary || currentIsBinary;
    const sameContent = cf.content === vf.content;

    if (sameContent) {
      diffs.push({
        relativePath: vf.relativePath,
        status: 'unchanged',
        isBinary,
      });
    } else if (isBinary) {
      diffs.push({
        relativePath: vf.relativePath,
        status: 'binary',
        isBinary: true,
      });
    } else {
      diffs.push({
        relativePath: vf.relativePath,
        status: 'modified',
        currentContent: cf.content,
        versionContent: vf.content,
      });
    }
  }

  for (const cf of currentFiles) {
    if (!versionMap.has(cf.relativePath)) {
      const isBinary = cf.encoding === 'base64';
      diffs.push({
        relativePath: cf.relativePath,
        status: 'added',
        currentContent: isBinary ? undefined : cf.content,
        isBinary,
      });
    }
  }

  const order: Record<string, number> = { modified: 0, binary: 1, added: 2, removed: 3, unchanged: 4 };
  diffs.sort((a, b) => (order[a.status] ?? 99) - (order[b.status] ?? 99));

  return diffs;
}
