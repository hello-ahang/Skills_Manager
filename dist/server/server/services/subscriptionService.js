import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
// All importService functions are dynamically imported to avoid module-level failures
const USER_CONFIG_DIR = path.join(os.homedir(), '.skills-manager');
const SUBSCRIPTIONS_PATH = path.join(USER_CONFIG_DIR, 'subscriptions.json');
const AUTO_UPDATE_CONFIG_PATH = path.join(USER_CONFIG_DIR, 'auto-update-config.json');
// ==================== Helpers ====================
async function readSubscriptions() {
    await fs.ensureDir(USER_CONFIG_DIR);
    if (await fs.pathExists(SUBSCRIPTIONS_PATH)) {
        try {
            return await fs.readJson(SUBSCRIPTIONS_PATH);
        }
        catch {
            return [];
        }
    }
    return [];
}
async function writeSubscriptions(subs) {
    await fs.ensureDir(USER_CONFIG_DIR);
    await fs.writeJson(SUBSCRIPTIONS_PATH, subs, { spaces: 2 });
}
// ==================== Public API ====================
export async function getSubscriptions() {
    try {
        return await readSubscriptions();
    }
    catch {
        return [];
    }
}
export async function subscribe(skillPath, skillName, source, sourceUrl, branch, version) {
    const subs = await readSubscriptions();
    // Check if already subscribed (by sourceUrl to merge duplicates)
    const existing = subs.find(s => s.sourceUrl === sourceUrl);
    if (existing) {
        // Update existing subscription with latest info
        existing.source = source;
        existing.skillPath = skillPath;
        existing.skillName = skillName;
        existing.branch = branch;
        existing.version = version;
        existing.subscribedAt = new Date().toISOString();
        await writeSubscriptions(subs);
        return existing;
    }
    const subscription = {
        id: uuidv4(),
        skillPath,
        skillName,
        source: source,
        sourceUrl,
        branch,
        version,
        subscribedAt: new Date().toISOString(),
        autoUpdate: false,
    };
    subs.push(subscription);
    await writeSubscriptions(subs);
    return subscription;
}
export async function unsubscribe(skillPath) {
    let subs = await readSubscriptions();
    subs = subs.filter(s => s.skillPath !== skillPath);
    await writeSubscriptions(subs);
}
// ==================== Helper: Collect Current Files ====================
async function collectCurrentFiles(dirPath) {
    const files = [];
    if (!await fs.pathExists(dirPath))
        return files;
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
// ==================== Helper: Scan by source ====================
async function scanBySource(source, sourceUrl, branch) {
    const importService = await import('./importService.js');
    switch (source) {
        case 'github':
            return importService.scanGitHub(sourceUrl, branch);
        case 'gitee':
            return importService.scanGitee(sourceUrl, branch);
        case 'gitlab':
            return importService.scanGitLab(sourceUrl, branch);
        case 'bitbucket':
            return importService.scanBitbucket(sourceUrl, branch);
        case 'clawhub':
            return importService.scanClawHub(sourceUrl);
        default:
            throw new Error(`Unsupported source: ${source}`);
    }
}
// ==================== Check Update ====================
export async function checkUpdate(skillPath) {
    const subs = await readSubscriptions();
    const sub = subs.find(s => s.skillPath === skillPath);
    if (!sub) {
        return { hasUpdate: false, subscription: null };
    }
    try {
        const scanResult = await scanBySource(sub.source, sub.sourceUrl, sub.branch);
        // Update last checked time
        sub.lastCheckedAt = new Date().toISOString();
        // Check version-based update
        const latestVersion = scanResult.repoInfo?.version;
        if (latestVersion) {
            sub.latestVersion = latestVersion;
            // If no version recorded yet (first-time subscription), treat current as up-to-date
            if (!sub.version) {
                sub.version = latestVersion;
                sub.hasUpdate = false;
            }
            else {
                sub.hasUpdate = latestVersion !== sub.version;
            }
        }
        await writeSubscriptions(subs);
        // Compare file counts/sizes as a heuristic (only if version check didn't find update)
        const currentFiles = await collectCurrentFiles(skillPath);
        const remoteSkill = scanResult.skills.find((s) => s.name === sub.skillName) || scanResult.skills[0];
        if (!remoteSkill) {
            return { hasUpdate: false, subscription: sub };
        }
        const hasVersionUpdate = latestVersion ? latestVersion !== sub.version : false;
        // Only use file heuristic when there's no version info at all
        const hasFileUpdate = !latestVersion && (remoteSkill.fileCount !== currentFiles.length ||
            remoteSkill.totalSize !== currentFiles.reduce((sum, f) => sum + f.size, 0));
        const hasUpdate = hasVersionUpdate || hasFileUpdate;
        return {
            hasUpdate,
            subscription: sub,
            newFiles: hasUpdate ? remoteSkill.files : undefined,
        };
    }
    catch (error) {
        return { hasUpdate: false, subscription: sub };
    }
}
// ==================== Apply Update ====================
export async function applyUpdate(skillPath) {
    const subs = await readSubscriptions();
    const sub = subs.find(s => s.skillPath === skillPath);
    if (!sub) {
        throw new Error('No subscription found for this skill');
    }
    // Create backup snapshot before update (dynamic import to avoid module-level failures)
    try {
        const { createVersion } = await import('./versionService.js');
        await createVersion(skillPath, 'auto', '更新前自动备份');
    }
    catch { /* ignore */ }
    // Re-scan and import
    const scanResult = await scanBySource(sub.source, sub.sourceUrl, sub.branch);
    const importService = await import('./importService.js');
    const options = {
        conflictStrategy: 'overwrite',
        importMode: 'copy',
        autoSnapshot: true,
    };
    const result = await importService.executeImport(scanResult.skills, options, sub.source, sub.sourceUrl);
    // Update subscription — record current version from latestVersion
    sub.lastUpdatedAt = new Date().toISOString();
    sub.lastCheckedAt = new Date().toISOString();
    if (sub.latestVersion) {
        sub.version = sub.latestVersion;
    }
    sub.hasUpdate = false;
    await writeSubscriptions(subs);
    return result;
}
// ==================== Batch Check Updates ====================
export async function checkAllUpdates() {
    const subs = await readSubscriptions();
    const results = [];
    for (const sub of subs) {
        try {
            const { hasUpdate, subscription } = await checkUpdate(sub.skillPath);
            results.push({
                id: sub.id,
                skillName: sub.skillName,
                hasUpdate,
                currentVersion: sub.version,
                latestVersion: subscription?.latestVersion,
            });
        }
        catch {
            results.push({
                id: sub.id,
                skillName: sub.skillName,
                hasUpdate: false,
                currentVersion: sub.version,
            });
        }
    }
    return { results };
}
export async function getAutoUpdateConfig() {
    if (await fs.pathExists(AUTO_UPDATE_CONFIG_PATH)) {
        try {
            return await fs.readJson(AUTO_UPDATE_CONFIG_PATH);
        }
        catch { /* ignore */ }
    }
    return { enabled: false, interval: 'weekly' };
}
export async function setAutoUpdateConfig(enabled, interval) {
    const config = await getAutoUpdateConfig();
    config.enabled = enabled;
    if (interval) {
        config.interval = interval;
    }
    await fs.ensureDir(USER_CONFIG_DIR);
    await fs.writeJson(AUTO_UPDATE_CONFIG_PATH, config, { spaces: 2 });
}
export async function runAutoUpdate() {
    const config = await getAutoUpdateConfig();
    if (!config.enabled)
        return [];
    const subs = await readSubscriptions();
    const autoUpdateSubs = subs.filter(s => s.autoUpdate);
    const results = [];
    for (const sub of autoUpdateSubs) {
        try {
            const { hasUpdate } = await checkUpdate(sub.skillPath);
            if (hasUpdate) {
                const result = await applyUpdate(sub.skillPath);
                results.push(result);
            }
        }
        catch { /* ignore individual failures */ }
    }
    // Update last run time
    config.lastRunAt = new Date().toISOString();
    await fs.writeJson(AUTO_UPDATE_CONFIG_PATH, config, { spaces: 2 });
    return results;
}
