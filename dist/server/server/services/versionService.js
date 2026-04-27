import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
const USER_CONFIG_DIR = path.join(os.homedir(), '.skills-manager');
const VERSIONS_DIR = path.join(USER_CONFIG_DIR, 'versions');
const INDEX_PATH = path.join(VERSIONS_DIR, 'index.json');
const SNAPSHOTS_DIR = path.join(VERSIONS_DIR, 'snapshots');
const MAX_VERSIONS_PER_SKILL = 20;
// ==================== Helpers ====================
async function ensureDirs() {
    await fs.ensureDir(VERSIONS_DIR);
    await fs.ensureDir(SNAPSHOTS_DIR);
}
async function readIndex() {
    await ensureDirs();
    if (await fs.pathExists(INDEX_PATH)) {
        try {
            return await fs.readJson(INDEX_PATH);
        }
        catch {
            return [];
        }
    }
    return [];
}
async function writeIndex(versions) {
    await ensureDirs();
    await fs.writeJson(INDEX_PATH, versions, { spaces: 2 });
}
/**
 * Recursively collect all files in a directory (relative paths + content).
 */
async function collectFiles(dirPath, basePath = dirPath) {
    const files = [];
    if (!await fs.pathExists(dirPath))
        return files;
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name.startsWith('.'))
            continue; // skip hidden files
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(basePath, fullPath);
        if (entry.isDirectory()) {
            const subFiles = await collectFiles(fullPath, basePath);
            files.push(...subFiles);
        }
        else {
            try {
                const content = await fs.readFile(fullPath, 'utf-8');
                const stat = await fs.stat(fullPath);
                files.push({
                    relativePath,
                    content,
                    size: stat.size,
                });
            }
            catch {
                // Skip unreadable files (binary, etc.)
            }
        }
    }
    return files;
}
/**
 * Enforce max versions per skill — remove oldest versions if over limit.
 */
async function enforceLimit(versions, skillPath) {
    const skillVersions = versions.filter(v => v.skillPath === skillPath);
    if (skillVersions.length <= MAX_VERSIONS_PER_SKILL)
        return versions;
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
export async function getVersionHistory(skillPath) {
    const allVersions = await readIndex();
    return allVersions
        .filter(v => v.skillPath === skillPath)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
/**
 * Create a new version snapshot for a skill.
 */
export async function createVersion(skillPath, version, label) {
    await ensureDirs();
    // Collect all files in the skill directory
    const files = await collectFiles(skillPath);
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const id = uuidv4();
    const now = new Date().toISOString();
    const versionMeta = {
        id,
        skillPath,
        version,
        label,
        createdAt: now,
        fileCount: files.length,
        totalSize,
    };
    // Save snapshot
    const detail = {
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
export async function getVersionDetail(versionId) {
    const snapshotPath = path.join(SNAPSHOTS_DIR, `${versionId}.json`);
    if (!await fs.pathExists(snapshotPath))
        return null;
    try {
        return await fs.readJson(snapshotPath);
    }
    catch {
        return null;
    }
}
/**
 * Restore a version — overwrite current files with snapshot.
 * Automatically creates a "before restore" snapshot first.
 */
export async function restoreVersion(versionId) {
    const detail = await getVersionDetail(versionId);
    if (!detail) {
        throw new Error('Version not found');
    }
    const { skillPath, files } = detail;
    // Verify skill directory exists
    if (!await fs.pathExists(skillPath)) {
        throw new Error(`Skill directory not found: ${skillPath}`);
    }
    // Auto-create backup before restore
    const backupVersion = await createVersion(skillPath, 'backup', '回滚前自动备份');
    // Remove all existing files in the skill directory (except hidden)
    const existingEntries = await fs.readdir(skillPath, { withFileTypes: true });
    for (const entry of existingEntries) {
        if (entry.name.startsWith('.'))
            continue;
        await fs.remove(path.join(skillPath, entry.name));
    }
    // Write snapshot files
    for (const file of files) {
        const targetPath = path.join(skillPath, file.relativePath);
        await fs.ensureDir(path.dirname(targetPath));
        await fs.writeFile(targetPath, file.content, 'utf-8');
    }
    return { success: true, backupVersionId: backupVersion.id };
}
/**
 * Delete a version.
 */
export async function deleteVersion(versionId) {
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
export async function diffVersion(versionId) {
    const detail = await getVersionDetail(versionId);
    if (!detail) {
        throw new Error('Version not found');
    }
    const { skillPath, files: versionFiles } = detail;
    const diffs = [];
    // Collect current files
    const currentFiles = await collectFiles(skillPath);
    const currentMap = new Map(currentFiles.map(f => [f.relativePath, f.content]));
    const versionMap = new Map(versionFiles.map(f => [f.relativePath, f.content]));
    // Check files in version snapshot
    for (const vf of versionFiles) {
        const currentContent = currentMap.get(vf.relativePath);
        if (currentContent === undefined) {
            // File exists in version but not in current → was removed
            diffs.push({
                relativePath: vf.relativePath,
                status: 'removed',
                versionContent: vf.content,
            });
        }
        else if (currentContent !== vf.content) {
            // File exists in both but content differs
            diffs.push({
                relativePath: vf.relativePath,
                status: 'modified',
                currentContent,
                versionContent: vf.content,
            });
        }
        else {
            diffs.push({
                relativePath: vf.relativePath,
                status: 'unchanged',
            });
        }
    }
    // Check files in current that don't exist in version → were added
    for (const cf of currentFiles) {
        if (!versionMap.has(cf.relativePath)) {
            diffs.push({
                relativePath: cf.relativePath,
                status: 'added',
                currentContent: cf.content,
            });
        }
    }
    // Sort: modified first, then added, then removed, then unchanged
    const order = { modified: 0, added: 1, removed: 2, unchanged: 3 };
    diffs.sort((a, b) => order[a.status] - order[b.status]);
    return diffs;
}
