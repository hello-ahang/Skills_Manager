import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import { getConfig } from './configService.js';
import { createVersion } from './versionService.js';
import { syncLinks } from './linkService.js';
// Re-export sub-modules for external consumers
export { parseGitHubUrl, parseGiteeUrl, parseGitLabUrl, parseClawHubUrl, parseBitbucketUrl } from './import/urlParsers.js';
export { registerImportProvider, getImportProviders, detectProvider } from './import/providerRegistry.js';
// Internal imports from sub-modules
import { parseGitHubUrl, parseGiteeUrl, parseGitLabUrl, parseClawHubUrl, parseBitbucketUrl } from './import/urlParsers.js';
import { registerImportProvider } from './import/providerRegistry.js';
import { getGitHubRepoInfo, downloadRepoAsZip, getGiteeRepoInfo, getGitLabRepoInfo, getBitbucketRepoInfo, downloadBitbucketContents, } from './import/gitApis.js';
const TEMP_DIR = path.join(os.tmpdir(), 'skills-manager-import');
// ==================== Skill Scanning ====================
export async function scanForSkills(dirPath) {
    const skills = [];
    if (!await fs.pathExists(dirPath))
        return skills;
    // Check if dirPath itself is a skill (contains SKILL.md)
    const skillMdPath = path.join(dirPath, 'SKILL.md');
    if (await fs.pathExists(skillMdPath)) {
        const skill = await buildScannedSkill(dirPath);
        skills.push(skill);
        return skills;
    }
    // Track valid skill names to avoid duplicates
    const validSkillNames = new Set();
    // Scan subdirectories for valid skills (with SKILL.md)
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.'))
            continue;
        const subDir = path.join(dirPath, entry.name);
        const subSkillMd = path.join(subDir, 'SKILL.md');
        if (await fs.pathExists(subSkillMd)) {
            const skill = await buildScannedSkill(subDir);
            skills.push(skill);
            validSkillNames.add(entry.name);
        }
        else {
            // Recursively scan deeper
            const subSkills = await scanForSkills(subDir);
            for (const s of subSkills) {
                skills.push(s);
                validSkillNames.add(s.name);
            }
        }
    }
    // Also add top-level directories that are NOT already valid skills
    // These are marked as isValid=false and selected=false (user can opt-in)
    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.'))
            continue;
        if (validSkillNames.has(entry.name))
            continue;
        const subDir = path.join(dirPath, entry.name);
        const files = await collectFileList(subDir);
        if (files.length > 0) {
            skills.push({
                name: entry.name,
                path: subDir,
                fileCount: files.length,
                totalSize: files.reduce((sum, f) => sum + f.size, 0),
                isValid: false,
                files,
                selected: false, // not selected by default
            });
        }
    }
    // If no skills found at all (no valid and no directories), treat entire dir as potential skill
    if (skills.length === 0) {
        const files = await collectFileList(dirPath);
        if (files.length > 0) {
            skills.push({
                name: path.basename(dirPath),
                path: dirPath,
                fileCount: files.length,
                totalSize: files.reduce((sum, f) => sum + f.size, 0),
                isValid: false,
                files,
                selected: true,
            });
        }
    }
    return skills;
}
async function buildScannedSkill(dirPath) {
    const files = await collectFileList(dirPath);
    const skillMdPath = path.join(dirPath, 'SKILL.md');
    let description;
    try {
        const content = await fs.readFile(skillMdPath, 'utf-8');
        // Extract description from frontmatter or first paragraph
        const fmMatch = content.match(/^---\s*\n[\s\S]*?description:\s*(.+)\n[\s\S]*?\n---/);
        if (fmMatch) {
            description = fmMatch[1].trim();
        }
        else {
            // Try first non-heading paragraph
            const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
            if (lines.length > 0) {
                description = lines[0].trim().substring(0, 200);
            }
        }
    }
    catch { /* ignore */ }
    return {
        name: path.basename(dirPath),
        path: dirPath,
        description,
        fileCount: files.length,
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
        isValid: true,
        files,
        selected: true,
    };
}
async function collectFileList(dirPath) {
    const files = [];
    async function walk(currentPath) {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name.startsWith('.'))
                continue;
            const fullPath = path.join(currentPath, entry.name);
            if (entry.isDirectory()) {
                await walk(fullPath);
            }
            else {
                const stat = await fs.stat(fullPath);
                files.push({
                    relativePath: path.relative(dirPath, fullPath),
                    size: stat.size,
                });
            }
        }
    }
    await walk(dirPath);
    return files;
}
// ==================== Conflict Detection ====================
export async function checkConflicts(skillNames, targetSourceDirId) {
    const config = await getConfig();
    let targetDir = '';
    if (targetSourceDirId && config.sourceDirs?.length > 0) {
        const found = config.sourceDirs.find(s => s.id === targetSourceDirId);
        if (found)
            targetDir = found.path;
    }
    if (!targetDir) {
        if (config.activeSourceDirId && config.sourceDirs?.length > 0) {
            const active = config.sourceDirs.find(s => s.id === config.activeSourceDirId);
            if (active)
                targetDir = active.path;
        }
        if (!targetDir)
            targetDir = config.sourceDir;
    }
    if (!targetDir)
        return [];
    const conflicts = [];
    for (const name of skillNames) {
        const existingPath = path.join(targetDir, name);
        if (await fs.pathExists(existingPath)) {
            conflicts.push({ name, existingPath });
        }
    }
    return conflicts;
}
// ==================== Import Execution ====================
async function resolveTargetDir(targetSourceDirId) {
    const config = await getConfig();
    let targetDir = '';
    if (targetSourceDirId && config.sourceDirs?.length > 0) {
        const found = config.sourceDirs.find(s => s.id === targetSourceDirId);
        if (found)
            targetDir = found.path;
    }
    if (!targetDir) {
        if (config.activeSourceDirId && config.sourceDirs?.length > 0) {
            const active = config.sourceDirs.find(s => s.id === config.activeSourceDirId);
            if (active)
                targetDir = active.path;
        }
        if (!targetDir)
            targetDir = config.sourceDir;
    }
    if (!targetDir) {
        throw new Error('No source directory configured. Please add a source directory first.');
    }
    return targetDir;
}
export async function executeImport(skills, options, source, sourceUrl) {
    const startTime = Date.now();
    const targetDir = await resolveTargetDir(options.targetSourceDirId);
    const result = {
        source,
        sourceUrl,
        totalCount: skills.length,
        successCount: 0,
        skipCount: 0,
        failCount: 0,
        importedSkills: [],
        skippedSkills: [],
        failedSkills: [],
        duration: 0,
    };
    for (const skill of skills) {
        if (!skill.selected) {
            result.skipCount++;
            result.skippedSkills.push({ name: skill.name, reason: 'Not selected' });
            continue;
        }
        const destPath = path.join(targetDir, skill.name);
        try {
            // Handle conflict
            if (await fs.pathExists(destPath)) {
                const strategy = skill.conflictAction || options.conflictStrategy;
                if (strategy === 'skip') {
                    result.skipCount++;
                    result.skippedSkills.push({ name: skill.name, reason: 'Already exists (skipped)' });
                    continue;
                }
                if (strategy === 'overwrite') {
                    // Create snapshot before overwriting
                    if (options.autoSnapshot) {
                        try {
                            await createVersion(destPath, 'auto', '导入覆盖前自动备份');
                        }
                        catch { /* ignore snapshot errors */ }
                    }
                    await fs.remove(destPath);
                }
                if (strategy === 'rename') {
                    // Find available name
                    let counter = 2;
                    let newName = `${skill.name}-${counter}`;
                    while (await fs.pathExists(path.join(targetDir, newName))) {
                        counter++;
                        newName = `${skill.name}-${counter}`;
                    }
                    skill.name = newName;
                    const newDestPath = path.join(targetDir, newName);
                    await copySkillToTarget(skill.path, newDestPath, options.importMode);
                    if (options.autoSnapshot) {
                        try {
                            await createVersion(newDestPath, '1.0.0', '初始导入');
                        }
                        catch { /* ignore */ }
                    }
                    result.successCount++;
                    result.importedSkills.push({ name: newName, path: newDestPath });
                    continue;
                }
                if (strategy === 'merge') {
                    // Merge: copy new files, skip existing ones
                    await mergeSkillToTarget(skill.path, destPath);
                    if (options.autoSnapshot) {
                        try {
                            await createVersion(destPath, 'auto', '合并导入');
                        }
                        catch { /* ignore */ }
                    }
                    result.successCount++;
                    result.importedSkills.push({ name: skill.name, path: destPath });
                    continue;
                }
            }
            // Normal import
            await copySkillToTarget(skill.path, destPath, options.importMode);
            // Create version snapshot
            if (options.autoSnapshot) {
                try {
                    await createVersion(destPath, '1.0.0', '初始导入');
                }
                catch { /* ignore snapshot errors */ }
            }
            result.successCount++;
            result.importedSkills.push({ name: skill.name, path: destPath });
        }
        catch (error) {
            result.failCount++;
            result.failedSkills.push({
                name: skill.name,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    result.duration = Date.now() - startTime;
    // Auto-sync to all bound projects after import (if enabled via options)
    if (result.successCount > 0 && options.autoSyncAfterImport) {
        try {
            const config = await getConfig();
            if (config.projects.length > 0) {
                const projectIds = config.projects.map((p) => p.id);
                await syncLinks(projectIds, undefined, 'backup-replace', options.targetSourceDirId);
            }
        }
        catch {
            // Non-blocking: don't fail the import if auto-sync fails
        }
    }
    return result;
}
async function copySkillToTarget(sourcePath, destPath, mode) {
    await fs.ensureDir(path.dirname(destPath));
    switch (mode) {
        case 'move':
            await fs.move(sourcePath, destPath, { overwrite: true });
            break;
        case 'symlink':
            await fs.symlink(sourcePath, destPath, 'dir');
            break;
        case 'copy':
        default:
            await fs.copy(sourcePath, destPath, { overwrite: true });
            break;
    }
}
async function mergeSkillToTarget(sourcePath, destPath) {
    const entries = await fs.readdir(sourcePath, { withFileTypes: true });
    for (const entry of entries) {
        const srcItem = path.join(sourcePath, entry.name);
        const destItem = path.join(destPath, entry.name);
        if (entry.isDirectory()) {
            if (await fs.pathExists(destItem)) {
                await mergeSkillToTarget(srcItem, destItem);
            }
            else {
                await fs.copy(srcItem, destItem);
            }
        }
        else {
            if (!await fs.pathExists(destItem)) {
                await fs.copy(srcItem, destItem);
            }
            // Skip existing files in merge mode
        }
    }
}
// ==================== GitHub Import ====================
export async function scanGitHub(url, branch, token) {
    const parsed = parseGitHubUrl(url);
    if (!parsed) {
        throw new Error('Invalid GitHub URL. Expected format: https://github.com/owner/repo');
    }
    // Try to get repoInfo via API (only if token is available to avoid rate limit)
    let repoInfo;
    let targetBranch = branch || parsed.branch;
    if (token) {
        // With token: use API to get accurate repo info
        repoInfo = await getGitHubRepoInfo(parsed.owner, parsed.repo, token);
        if (!targetBranch)
            targetBranch = repoInfo.defaultBranch;
    }
    else {
        // Without token: construct basic info from URL, skip API call entirely
        repoInfo = {
            name: parsed.repo,
            defaultBranch: 'main',
            url: `https://github.com/${parsed.owner}/${parsed.repo}`,
        };
        if (!targetBranch)
            targetBranch = 'main';
    }
    // Download repo as ZIP (no API rate limit)
    const tempDir = path.join(TEMP_DIR, `github-${uuidv4()}`);
    await fs.ensureDir(tempDir);
    try {
        const zipHeaders = {};
        if (token)
            zipHeaders['Authorization'] = `Bearer ${token}`;
        let repoDir;
        try {
            const zipUrl = `https://github.com/${parsed.owner}/${parsed.repo}/archive/refs/heads/${targetBranch}.zip`;
            const zipResult = await downloadRepoAsZip(zipUrl, tempDir, zipHeaders);
            repoDir = zipResult.dir;
        }
        catch {
            // If 'main' branch fails, try 'master' as fallback
            if (!branch && !parsed.branch && targetBranch === 'main') {
                targetBranch = 'master';
                repoInfo.defaultBranch = 'master';
                const fallbackUrl = `https://github.com/${parsed.owner}/${parsed.repo}/archive/refs/heads/master.zip`;
                const zipResult = await downloadRepoAsZip(fallbackUrl, tempDir, zipHeaders);
                repoDir = zipResult.dir;
            }
            else {
                throw new Error(`Failed to download repository. Branch "${targetBranch}" may not exist.`);
            }
        }
        // If subPath specified, use that subdirectory
        const scanDir = parsed.subPath ? path.join(repoDir, parsed.subPath) : repoDir;
        if (parsed.subPath && !(await fs.pathExists(scanDir))) {
            throw new Error(`Path "${parsed.subPath}" not found in repository`);
        }
        // Scan for skills
        const skills = await scanForSkills(scanDir);
        // Check conflicts
        const config = await getConfig();
        let targetDir = config.sourceDir;
        if (config.activeSourceDirId && config.sourceDirs?.length > 0) {
            const active = config.sourceDirs.find(s => s.id === config.activeSourceDirId);
            if (active)
                targetDir = active.path;
        }
        if (targetDir) {
            for (const skill of skills) {
                const existingPath = path.join(targetDir, skill.name);
                skill.hasConflict = await fs.pathExists(existingPath);
            }
        }
        return { skills, repoInfo };
    }
    catch (error) {
        await fs.remove(tempDir).catch(() => { });
        throw error;
    }
}
export async function importFromGitHub(url, options, branch) {
    const { skills } = await scanGitHub(url, branch);
    return executeImport(skills, options, 'github', url);
}
// ==================== Gitee Import ====================
export async function scanGitee(url, branch, token) {
    const parsed = parseGiteeUrl(url);
    if (!parsed) {
        throw new Error('Invalid Gitee URL. Expected format: https://gitee.com/owner/repo');
    }
    let repoInfo;
    let targetBranch = branch || parsed.branch;
    if (token) {
        repoInfo = await getGiteeRepoInfo(parsed.owner, parsed.repo, token);
        if (!targetBranch)
            targetBranch = repoInfo.defaultBranch;
    }
    else {
        repoInfo = {
            name: parsed.repo,
            defaultBranch: 'master',
            url: `https://gitee.com/${parsed.owner}/${parsed.repo}`,
        };
        if (!targetBranch)
            targetBranch = 'master';
    }
    const tempDir = path.join(TEMP_DIR, `gitee-${uuidv4()}`);
    await fs.ensureDir(tempDir);
    try {
        // Gitee ZIP download URL
        let zipUrl = `https://gitee.com/${parsed.owner}/${parsed.repo}/repository/archive/${targetBranch}.zip`;
        if (token) {
            zipUrl += `?access_token=${token}`;
        }
        let repoDir;
        try {
            const zipResult = await downloadRepoAsZip(zipUrl, tempDir);
            repoDir = zipResult.dir;
        }
        catch {
            if (!branch && !parsed.branch && targetBranch === 'master') {
                targetBranch = 'main';
                repoInfo.defaultBranch = 'main';
                let fallbackUrl = `https://gitee.com/${parsed.owner}/${parsed.repo}/repository/archive/main.zip`;
                if (token)
                    fallbackUrl += `?access_token=${token}`;
                const zipResult = await downloadRepoAsZip(fallbackUrl, tempDir);
                repoDir = zipResult.dir;
            }
            else {
                throw new Error(`Failed to download repository. Branch "${targetBranch}" may not exist.`);
            }
        }
        const scanDir = parsed.subPath ? path.join(repoDir, parsed.subPath) : repoDir;
        if (parsed.subPath && !(await fs.pathExists(scanDir))) {
            throw new Error(`Path "${parsed.subPath}" not found in repository`);
        }
        const skills = await scanForSkills(scanDir);
        const config = await getConfig();
        let targetDir = config.sourceDir;
        if (config.activeSourceDirId && config.sourceDirs?.length > 0) {
            const active = config.sourceDirs.find(s => s.id === config.activeSourceDirId);
            if (active)
                targetDir = active.path;
        }
        if (targetDir) {
            for (const skill of skills) {
                skill.hasConflict = await fs.pathExists(path.join(targetDir, skill.name));
            }
        }
        return { skills, repoInfo };
    }
    catch (error) {
        await fs.remove(tempDir).catch(() => { });
        throw error;
    }
}
export async function importFromGitee(url, options, branch) {
    const { skills } = await scanGitee(url, branch);
    return executeImport(skills, options, 'gitee', url);
}
// ==================== GitLab Import ====================
export async function scanGitLab(url, branch, token) {
    const parsed = parseGitLabUrl(url);
    if (!parsed) {
        throw new Error('Invalid GitLab URL.');
    }
    let repoInfo;
    let targetBranch = branch || parsed.branch;
    if (token) {
        repoInfo = await getGitLabRepoInfo(parsed.host, parsed.projectPath, token);
        if (!targetBranch)
            targetBranch = repoInfo.defaultBranch;
    }
    else {
        const projectName = parsed.projectPath.split('/').pop() || parsed.projectPath;
        repoInfo = {
            name: projectName,
            defaultBranch: 'main',
            url: `https://${parsed.host}/${parsed.projectPath}`,
        };
        if (!targetBranch)
            targetBranch = 'main';
    }
    const tempDir = path.join(TEMP_DIR, `gitlab-${uuidv4()}`);
    await fs.ensureDir(tempDir);
    try {
        // GitLab ZIP download URL
        const encodedProject = encodeURIComponent(parsed.projectPath);
        const zipHeaders = {};
        if (token)
            zipHeaders['PRIVATE-TOKEN'] = token;
        let repoDir;
        try {
            const zipUrl = `https://${parsed.host}/api/v4/projects/${encodedProject}/repository/archive.zip?sha=${targetBranch}`;
            const zipResult = await downloadRepoAsZip(zipUrl, tempDir, zipHeaders);
            repoDir = zipResult.dir;
        }
        catch {
            if (!branch && !parsed.branch && targetBranch === 'main') {
                targetBranch = 'master';
                repoInfo.defaultBranch = 'master';
                const fallbackUrl = `https://${parsed.host}/api/v4/projects/${encodedProject}/repository/archive.zip?sha=master`;
                const zipResult = await downloadRepoAsZip(fallbackUrl, tempDir, zipHeaders);
                repoDir = zipResult.dir;
            }
            else {
                throw new Error(`Failed to download repository. Branch "${targetBranch}" may not exist.`);
            }
        }
        const scanDir = parsed.subPath ? path.join(repoDir, parsed.subPath) : repoDir;
        if (parsed.subPath && !(await fs.pathExists(scanDir))) {
            throw new Error(`Path "${parsed.subPath}" not found in repository`);
        }
        const skills = await scanForSkills(scanDir);
        const config = await getConfig();
        let targetDir = config.sourceDir;
        if (config.activeSourceDirId && config.sourceDirs?.length > 0) {
            const active = config.sourceDirs.find(s => s.id === config.activeSourceDirId);
            if (active)
                targetDir = active.path;
        }
        if (targetDir) {
            for (const skill of skills) {
                skill.hasConflict = await fs.pathExists(path.join(targetDir, skill.name));
            }
        }
        return { skills, repoInfo };
    }
    catch (error) {
        await fs.remove(tempDir).catch(() => { });
        throw error;
    }
}
export async function importFromGitLab(url, options, branch) {
    const { skills } = await scanGitLab(url, branch);
    return executeImport(skills, options, 'gitlab', url);
}
// ==================== Bitbucket Import ====================
export async function scanBitbucket(url, branch) {
    const parsed = parseBitbucketUrl(url);
    if (!parsed) {
        throw new Error('Invalid Bitbucket URL.');
    }
    const repoInfo = await getBitbucketRepoInfo(parsed.owner, parsed.repo);
    const targetBranch = branch || parsed.branch || repoInfo.defaultBranch;
    const tempDir = path.join(TEMP_DIR, `bitbucket-${uuidv4()}`);
    await fs.ensureDir(tempDir);
    try {
        await downloadBitbucketContents(parsed.owner, parsed.repo, parsed.subPath || '', targetBranch, tempDir);
        const skills = await scanForSkills(tempDir);
        const config = await getConfig();
        let targetDir = config.sourceDir;
        if (config.activeSourceDirId && config.sourceDirs?.length > 0) {
            const active = config.sourceDirs.find(s => s.id === config.activeSourceDirId);
            if (active)
                targetDir = active.path;
        }
        if (targetDir) {
            for (const skill of skills) {
                skill.hasConflict = await fs.pathExists(path.join(targetDir, skill.name));
            }
        }
        return { skills, repoInfo };
    }
    catch (error) {
        await fs.remove(tempDir).catch(() => { });
        throw error;
    }
}
export async function importFromBitbucket(url, options, branch) {
    const { skills } = await scanBitbucket(url, branch);
    return executeImport(skills, options, 'bitbucket', url);
}
// ==================== ClawHub Import ====================
export async function scanClawHub(url) {
    const parsed = parseClawHubUrl(url);
    if (!parsed) {
        throw new Error('Invalid ClawHub URL. Expected format: https://clawhub.ai/owner/skill');
    }
    const repoInfo = {
        name: parsed.skill,
        defaultBranch: 'latest',
        url: `https://clawhub.ai/${parsed.owner}/${parsed.skill}`,
    };
    const tempDir = path.join(TEMP_DIR, `clawhub-${uuidv4()}`);
    await fs.ensureDir(tempDir);
    try {
        // ClawHub ZIP download via API (slug = skill name only, no owner prefix)
        const zipUrl = `https://clawhub.ai/api/v1/download?slug=${parsed.skill}`;
        const zipResult = await downloadRepoAsZip(zipUrl, tempDir);
        let repoDir = zipResult.dir;
        // Extract version from content-disposition header
        // e.g. attachment; filename="self-improving-agent-3.0.16.zip" → "3.0.16"
        if (zipResult.contentDisposition) {
            const filenameMatch = zipResult.contentDisposition.match(/filename="?([^"]+)"?/);
            if (filenameMatch) {
                const filename = filenameMatch[1]; // e.g. "self-improving-agent-3.0.16.zip"
                const versionMatch = filename.match(/-(\d+\.\d+\.\d+(?:\.\d+)?)\.zip$/);
                if (versionMatch) {
                    repoInfo.version = versionMatch[1];
                }
            }
        }
        // ClawHub ZIPs have no top-level directory — files are at root.
        // Rename the extracted directory to the skill name so scanForSkills picks up the correct name.
        const properDir = path.join(path.dirname(repoDir), parsed.skill);
        if (repoDir !== properDir && !await fs.pathExists(properDir)) {
            await fs.rename(repoDir, properDir);
            repoDir = properDir;
        }
        const skills = await scanForSkills(repoDir);
        const config = await getConfig();
        let targetDir = config.sourceDir;
        if (config.activeSourceDirId && config.sourceDirs?.length > 0) {
            const active = config.sourceDirs.find(s => s.id === config.activeSourceDirId);
            if (active)
                targetDir = active.path;
        }
        if (targetDir) {
            for (const skill of skills) {
                skill.hasConflict = await fs.pathExists(path.join(targetDir, skill.name));
            }
        }
        return { skills, repoInfo };
    }
    catch (error) {
        await fs.remove(tempDir).catch(() => { });
        throw error;
    }
}
export async function importFromClawHub(url, options) {
    const { skills } = await scanClawHub(url);
    return executeImport(skills, options, 'clawhub', url);
}
// ==================== Local Import ====================
export async function scanLocal(sourcePath) {
    if (!await fs.pathExists(sourcePath)) {
        throw new Error(`Path not found: ${sourcePath}`);
    }
    const stat = await fs.stat(sourcePath);
    if (stat.isFile()) {
        // Single file — check if it's a SKILL.md
        const name = path.basename(sourcePath);
        if (name.toLowerCase() === 'skill.md') {
            // Treat parent directory as skill
            const parentDir = path.dirname(sourcePath);
            const skills = await scanForSkills(parentDir);
            return { skills };
        }
        // Single non-SKILL.md file — create a skill from it
        return {
            skills: [{
                    name: path.basename(sourcePath, path.extname(sourcePath)),
                    path: sourcePath,
                    fileCount: 1,
                    totalSize: stat.size,
                    isValid: false,
                    files: [{ relativePath: name, size: stat.size }],
                    selected: true,
                }],
        };
    }
    // Directory
    const skills = await scanForSkills(sourcePath);
    // Check conflicts
    const config = await getConfig();
    let targetDir = config.sourceDir;
    if (config.activeSourceDirId && config.sourceDirs?.length > 0) {
        const active = config.sourceDirs.find(s => s.id === config.activeSourceDirId);
        if (active)
            targetDir = active.path;
    }
    if (targetDir) {
        for (const skill of skills) {
            skill.hasConflict = await fs.pathExists(path.join(targetDir, skill.name));
        }
    }
    return { skills };
}
export async function importFromLocal(sourcePath, options) {
    const { skills } = await scanLocal(sourcePath);
    return executeImport(skills, options, 'local', sourcePath);
}
// ==================== ZIP Import ====================
export async function scanZip(zipPath) {
    if (!await fs.pathExists(zipPath)) {
        throw new Error(`ZIP file not found: ${zipPath}`);
    }
    const tempDir = path.join(TEMP_DIR, `zip-${uuidv4()}`);
    await fs.ensureDir(tempDir);
    try {
        // Extract ZIP
        const unzipper = await import('unzipper');
        await new Promise((resolve, reject) => {
            fs.createReadStream(zipPath)
                .pipe(unzipper.default.Extract({ path: tempDir }))
                .on('close', resolve)
                .on('error', reject);
        });
        // Scan for skills
        const skills = await scanForSkills(tempDir);
        // Check conflicts
        const config = await getConfig();
        let targetDir = config.sourceDir;
        if (config.activeSourceDirId && config.sourceDirs?.length > 0) {
            const active = config.sourceDirs.find(s => s.id === config.activeSourceDirId);
            if (active)
                targetDir = active.path;
        }
        if (targetDir) {
            for (const skill of skills) {
                skill.hasConflict = await fs.pathExists(path.join(targetDir, skill.name));
            }
        }
        return { skills, tempDir };
    }
    catch (error) {
        await fs.remove(tempDir).catch(() => { });
        throw error;
    }
}
export async function importFromZip(zipPath, options) {
    const { skills, tempDir } = await scanZip(zipPath);
    const result = await executeImport(skills, options, 'zip', zipPath);
    // Clean up temp directory
    await fs.remove(tempDir).catch(() => { });
    return result;
}
// ==================== Clipboard Import ====================
export async function scanClipboard(content) {
    // Extract skill name from first heading
    const headingMatch = content.match(/^#\s+(.+)$/m);
    let skillName = headingMatch ? headingMatch[1].trim() : 'imported-skill';
    // Sanitize name for use as directory name
    skillName = skillName
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fff-_]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'imported-skill';
    const tempDir = path.join(TEMP_DIR, `clipboard-${uuidv4()}`);
    const skillDir = path.join(tempDir, skillName);
    await fs.ensureDir(skillDir);
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), content, 'utf-8');
    const skills = await scanForSkills(skillDir);
    // Check conflicts
    const config = await getConfig();
    let targetDir = config.sourceDir;
    if (config.activeSourceDirId && config.sourceDirs?.length > 0) {
        const active = config.sourceDirs.find(s => s.id === config.activeSourceDirId);
        if (active)
            targetDir = active.path;
    }
    if (targetDir) {
        for (const skill of skills) {
            skill.hasConflict = await fs.pathExists(path.join(targetDir, skill.name));
        }
    }
    return { skills };
}
export async function importFromClipboard(content, options) {
    const { skills } = await scanClipboard(content);
    return executeImport(skills, options, 'clipboard');
}
// ==================== Batch Import ====================
export async function importBatch(urls, options) {
    const startTime = Date.now();
    const mergedResult = {
        source: 'batch',
        totalCount: 0,
        successCount: 0,
        skipCount: 0,
        failCount: 0,
        importedSkills: [],
        skippedSkills: [],
        failedSkills: [],
        duration: 0,
    };
    for (const url of urls) {
        const trimmedUrl = url.trim();
        if (!trimmedUrl)
            continue;
        try {
            let subResult;
            if (trimmedUrl.includes('github.com')) {
                subResult = await importFromGitHub(trimmedUrl, options);
            }
            else if (trimmedUrl.includes('gitee.com')) {
                subResult = await importFromGitee(trimmedUrl, options);
            }
            else if (trimmedUrl.includes('gitlab.')) {
                subResult = await importFromGitLab(trimmedUrl, options);
            }
            else if (trimmedUrl.includes('bitbucket.org')) {
                subResult = await importFromBitbucket(trimmedUrl, options);
            }
            else {
                mergedResult.failCount++;
                mergedResult.failedSkills.push({ name: trimmedUrl, error: 'Unsupported URL format' });
                continue;
            }
            mergedResult.totalCount += subResult.totalCount;
            mergedResult.successCount += subResult.successCount;
            mergedResult.skipCount += subResult.skipCount;
            mergedResult.failCount += subResult.failCount;
            mergedResult.importedSkills.push(...subResult.importedSkills);
            mergedResult.skippedSkills.push(...subResult.skippedSkills);
            mergedResult.failedSkills.push(...subResult.failedSkills);
        }
        catch (error) {
            mergedResult.failCount++;
            mergedResult.failedSkills.push({
                name: trimmedUrl,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    mergedResult.duration = Date.now() - startTime;
    return mergedResult;
}
// ==================== CSV/JSON Import/Export ====================
export async function importFromCSV(csvContent, options) {
    // Parse CSV: each row is a URL or path
    const lines = csvContent.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    const urls = [];
    for (const line of lines) {
        // Support CSV with columns: url, name (optional)
        const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
        if (parts[0])
            urls.push(parts[0]);
    }
    return importBatch(urls, options);
}
export async function importFromJSON(jsonContent, options) {
    const data = JSON.parse(jsonContent);
    const urls = [];
    if (Array.isArray(data)) {
        for (const item of data) {
            if (typeof item === 'string') {
                urls.push(item);
            }
            else if (item.url) {
                urls.push(item.url);
            }
        }
    }
    return importBatch(urls, options);
}
export async function exportToCSV() {
    // Read import history and generate CSV
    const historyPath = path.join(os.homedir(), '.skills-manager', 'import-history.json');
    if (!await fs.pathExists(historyPath))
        return 'source,url,skill_name,timestamp,status\n';
    const history = await fs.readJson(historyPath);
    let csv = 'source,url,skill_name,timestamp,status\n';
    for (const item of history) {
        for (const skill of item.result.importedSkills) {
            csv += `${item.source},"${item.sourceUrl || ''}","${skill.name}","${item.timestamp}",success\n`;
        }
        for (const skill of item.result.skippedSkills) {
            csv += `${item.source},"${item.sourceUrl || ''}","${skill.name}","${item.timestamp}",skipped\n`;
        }
        for (const skill of item.result.failedSkills) {
            csv += `${item.source},"${item.sourceUrl || ''}","${skill.name}","${item.timestamp}",failed\n`;
        }
    }
    return csv;
}
export async function exportToJSON() {
    const historyPath = path.join(os.homedir(), '.skills-manager', 'import-history.json');
    if (!await fs.pathExists(historyPath))
        return '[]';
    const history = await fs.readJson(historyPath);
    return JSON.stringify(history, null, 2);
}
// ==================== Cleanup ====================
export async function cleanupTempFiles() {
    if (await fs.pathExists(TEMP_DIR)) {
        await fs.remove(TEMP_DIR);
    }
}
// ==================== Auto-detect URL type ====================
export function detectUrlType(url) {
    if (url.includes('github.com'))
        return 'github';
    if (url.includes('gitee.com'))
        return 'gitee';
    if (url.includes('gitlab.'))
        return 'gitlab';
    if (url.includes('bitbucket.org'))
        return 'bitbucket';
    if (url.includes('clawhub.ai'))
        return 'clawhub';
    return null;
}
// ==================== Register Built-in Providers ====================
registerImportProvider({
    id: 'github',
    name: 'GitHub',
    icon: 'Github',
    group: 'builtin',
    requiresAuth: false,
    authFields: [
        { key: 'token', label: 'Personal Access Token', type: 'password', placeholder: 'ghp_xxxx (optional, for private repos)' },
    ],
    scan: async (url, opts) => {
        const result = await scanGitHub(url, opts?.branch, opts?.token);
        return { skills: result.skills, repoInfo: result.repoInfo };
    },
    matchUrl: (url) => url.includes('github.com'),
});
registerImportProvider({
    id: 'gitee',
    name: 'Gitee',
    icon: 'GitBranch',
    group: 'builtin',
    requiresAuth: false,
    authFields: [
        { key: 'token', label: 'Private Token', type: 'password', placeholder: 'Gitee private token (optional)' },
    ],
    scan: async (url, opts) => {
        const result = await scanGitee(url, opts?.branch, opts?.token);
        return { skills: result.skills, repoInfo: result.repoInfo };
    },
    matchUrl: (url) => url.includes('gitee.com'),
});
registerImportProvider({
    id: 'gitlab',
    name: 'GitLab',
    icon: 'GitMerge',
    group: 'builtin',
    requiresAuth: false,
    authFields: [
        { key: 'token', label: 'Private Token', type: 'password', placeholder: 'GitLab private token (optional)' },
    ],
    scan: async (url, opts) => {
        const result = await scanGitLab(url, opts?.branch, opts?.token);
        return { skills: result.skills, repoInfo: result.repoInfo };
    },
    matchUrl: (url) => url.includes('gitlab.'),
});
registerImportProvider({
    id: 'bitbucket',
    name: 'Bitbucket',
    icon: 'GitBranch',
    group: 'builtin',
    scan: async (url, opts) => {
        const result = await scanBitbucket(url, opts?.branch);
        return { skills: result.skills, repoInfo: result.repoInfo };
    },
    matchUrl: (url) => url.includes('bitbucket.org'),
});
registerImportProvider({
    id: 'clawhub',
    name: 'ClawHub',
    icon: 'Package',
    group: 'builtin',
    scan: async (url) => {
        const result = await scanClawHub(url);
        return { skills: result.skills, repoInfo: result.repoInfo };
    },
    matchUrl: (url) => url.includes('clawhub.ai'),
});
registerImportProvider({
    id: 'local',
    name: 'Local File/Folder',
    icon: 'FolderOpen',
    group: 'builtin',
    scan: async (sourcePath) => {
        const result = await scanLocal(sourcePath);
        return { skills: result.skills };
    },
});
registerImportProvider({
    id: 'zip',
    name: 'ZIP Archive',
    icon: 'FileArchive',
    group: 'builtin',
    scan: async (zipPath) => {
        const result = await scanZip(zipPath);
        return { skills: result.skills };
    },
});
registerImportProvider({
    id: 'clipboard',
    name: 'Clipboard',
    icon: 'Clipboard',
    group: 'builtin',
    scan: async (content) => {
        const result = await scanClipboard(content);
        return { skills: result.skills };
    },
});
