import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Subscription, ImportResult, ImportOptions } from '../../src/types/index.js';
// All importService functions are dynamically imported to avoid module-level failures

const USER_CONFIG_DIR = path.join(os.homedir(), '.skills-manager');
const SUBSCRIPTIONS_PATH = path.join(USER_CONFIG_DIR, 'subscriptions.json');
const AUTO_UPDATE_CONFIG_PATH = path.join(USER_CONFIG_DIR, 'auto-update-config.json');

// ==================== Helpers ====================

async function readSubscriptions(): Promise<Subscription[]> {
  await fs.ensureDir(USER_CONFIG_DIR);
  if (await fs.pathExists(SUBSCRIPTIONS_PATH)) {
    try {
      return await fs.readJson(SUBSCRIPTIONS_PATH);
    } catch {
      return [];
    }
  }
  return [];
}

async function writeSubscriptions(subs: Subscription[]): Promise<void> {
  await fs.ensureDir(USER_CONFIG_DIR);
  await fs.writeJson(SUBSCRIPTIONS_PATH, subs, { spaces: 2 });
}

// ==================== Public API ====================

export async function getSubscriptions(): Promise<Subscription[]> {
  try {
    return await readSubscriptions();
  } catch {
    return [];
  }
}

export async function subscribe(
  skillPath: string,
  skillName: string,
  source: string,
  sourceUrl: string,
  branch?: string,
  version?: string
): Promise<Subscription> {
  const subs = await readSubscriptions();

  // Check if already subscribed (by sourceUrl to merge duplicates)
  const existing = subs.find(s => s.sourceUrl === sourceUrl);
  if (existing) {
    // Update existing subscription with latest info
    existing.source = source as any;
    existing.skillPath = skillPath;
    existing.skillName = skillName;
    existing.branch = branch;
    existing.version = version;
    existing.subscribedAt = new Date().toISOString();
    await writeSubscriptions(subs);
    return existing;
  }

  const subscription: Subscription = {
    id: uuidv4(),
    skillPath,
    skillName,
    source: source as any,
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

export async function unsubscribe(skillPath: string): Promise<void> {
  let subs = await readSubscriptions();
  subs = subs.filter(s => s.skillPath !== skillPath);
  await writeSubscriptions(subs);
}

// ==================== Helper: Collect Current Files ====================

async function collectCurrentFiles(dirPath: string): Promise<{ relativePath: string; size: number }[]> {
  const files: { relativePath: string; size: number }[] = [];
  if (!await fs.pathExists(dirPath)) return files;

  async function walk(currentPath: string) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
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

async function scanBySource(source: string, sourceUrl: string, branch?: string) {
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

export async function checkUpdate(skillPath: string): Promise<{
  hasUpdate: boolean;
  subscription: Subscription | null;
  newFiles?: { relativePath: string; size: number }[];
}> {
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
      sub.hasUpdate = latestVersion !== sub.version;
    }

    await writeSubscriptions(subs);

    // Compare file counts/sizes as a heuristic
    const currentFiles = await collectCurrentFiles(skillPath);
    const remoteSkill = scanResult.skills.find((s: any) => s.name === sub.skillName) || scanResult.skills[0];

    if (!remoteSkill) {
      return { hasUpdate: false, subscription: sub };
    }

    const hasVersionUpdate = latestVersion ? latestVersion !== sub.version : false;
    const hasFileUpdate = remoteSkill.fileCount !== currentFiles.length ||
      remoteSkill.totalSize !== currentFiles.reduce((sum: number, f: any) => sum + f.size, 0);
    const hasUpdate = hasVersionUpdate || hasFileUpdate;

    return {
      hasUpdate,
      subscription: sub,
      newFiles: hasUpdate ? remoteSkill.files : undefined,
    };
  } catch (error) {
    return { hasUpdate: false, subscription: sub };
  }
}

// ==================== Apply Update ====================

export async function applyUpdate(skillPath: string): Promise<ImportResult> {
  const subs = await readSubscriptions();
  const sub = subs.find(s => s.skillPath === skillPath);

  if (!sub) {
    throw new Error('No subscription found for this skill');
  }

  // Create backup snapshot before update (dynamic import to avoid module-level failures)
  try {
    const { createVersion } = await import('./versionService.js');
    await createVersion(skillPath, 'auto', '更新前自动备份');
  } catch { /* ignore */ }

  // Re-scan and import
  const scanResult = await scanBySource(sub.source, sub.sourceUrl, sub.branch);
  const importService = await import('./importService.js');

  const options: ImportOptions = {
    conflictStrategy: 'overwrite',
    importMode: 'copy',
    autoSnapshot: true,
  };

  const result = await importService.executeImport(scanResult.skills, options, sub.source as any, sub.sourceUrl);

  // Update subscription
  sub.lastUpdatedAt = new Date().toISOString();
  sub.lastCheckedAt = new Date().toISOString();
  await writeSubscriptions(subs);

  return result;
}

// ==================== Batch Check Updates ====================

export async function checkAllUpdates(): Promise<{
  results: { id: string; skillName: string; hasUpdate: boolean; currentVersion?: string; latestVersion?: string }[];
}> {
  const subs = await readSubscriptions();
  const results: { id: string; skillName: string; hasUpdate: boolean; currentVersion?: string; latestVersion?: string }[] = [];

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
    } catch {
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

// ==================== Auto-Update ====================

interface AutoUpdateConfig {
  enabled: boolean;
  interval: 'daily' | 'weekly' | 'monthly';
  lastRunAt?: string;
}

export async function getAutoUpdateConfig(): Promise<AutoUpdateConfig> {
  if (await fs.pathExists(AUTO_UPDATE_CONFIG_PATH)) {
    try {
      return await fs.readJson(AUTO_UPDATE_CONFIG_PATH);
    } catch { /* ignore */ }
  }
  return { enabled: false, interval: 'weekly' };
}

export async function setAutoUpdateConfig(enabled: boolean, interval?: string): Promise<void> {
  const config = await getAutoUpdateConfig();
  config.enabled = enabled;
  if (interval) {
    config.interval = interval as 'daily' | 'weekly' | 'monthly';
  }
  await fs.ensureDir(USER_CONFIG_DIR);
  await fs.writeJson(AUTO_UPDATE_CONFIG_PATH, config, { spaces: 2 });
}

export async function runAutoUpdate(): Promise<ImportResult[]> {
  const config = await getAutoUpdateConfig();
  if (!config.enabled) return [];

  const subs = await readSubscriptions();
  const autoUpdateSubs = subs.filter(s => s.autoUpdate);
  const results: ImportResult[] = [];

  for (const sub of autoUpdateSubs) {
    try {
      const { hasUpdate } = await checkUpdate(sub.skillPath);
      if (hasUpdate) {
        const result = await applyUpdate(sub.skillPath);
        results.push(result);
      }
    } catch { /* ignore individual failures */ }
  }

  // Update last run time
  config.lastRunAt = new Date().toISOString();
  await fs.writeJson(AUTO_UPDATE_CONFIG_PATH, config, { spaces: 2 });

  return results;
}