import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import type {
  ImportSource,
  ImportOptions,
  ScannedSkill,
  ImportResult,
  RepoInfo,
} from '../../src/types/index.js';
import { getConfig } from './configService.js';
import { createVersion } from './versionService.js';
import { syncLinks } from './linkService.js';

const TEMP_DIR = path.join(os.tmpdir(), 'skills-manager-import');

// ==================== Import Provider Registry ====================

export interface ImportProvider {
  /** 唯一标识符，如 'github', 'internal-git', 'internal-store' */
  id: string;
  /** 显示名称 */
  name: string;
  /** 图标名称（lucide-react 图标名） */
  icon: string;
  /** 分组：'builtin' | 'custom'，用于前端分区展示 */
  group: 'builtin' | 'custom';
  /** 是否需要认证 */
  requiresAuth?: boolean;
  /** 认证配置字段定义（用于动态生成设置表单） */
  authFields?: { key: string; label: string; type: 'text' | 'password'; placeholder?: string }[];
  /** 扫描：解析 URL/输入，返回可导入的 Skills 列表 */
  scan: (input: string, options?: Record<string, string>) => Promise<{ skills: ScannedSkill[]; repoInfo?: RepoInfo }>;
  /** URL 匹配：判断一个 URL 是否属于此 Provider */
  matchUrl?: (url: string) => boolean;
}

const importProviders: Map<string, ImportProvider> = new Map();

/** 注册一个导入 Provider */
export function registerImportProvider(provider: ImportProvider): void {
  importProviders.set(provider.id, provider);
}

/** 获取所有已注册的 Provider */
export function getImportProviders(): ImportProvider[] {
  return Array.from(importProviders.values());
}

/** 根据 URL 自动匹配 Provider */
export function detectProvider(url: string): ImportProvider | null {
  for (const provider of importProviders.values()) {
    if (provider.matchUrl?.(url)) return provider;
  }
  return null;
}

// ==================== GitHub URL Parsing ====================

interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  branch?: string;
  subPath?: string;
}

export function parseGitHubUrl(url: string): ParsedGitHubUrl | null {
  // Support formats:
  // https://github.com/owner/repo
  // https://github.com/owner/repo/tree/branch
  // https://github.com/owner/repo/tree/branch/path/to/dir
  const patterns = [
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)$/,
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/?$/,
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const [, owner, repo, branch, subPath] = match;
      return {
        owner,
        repo: repo.replace(/\.git$/, ''),
        branch: branch || undefined,
        subPath: subPath || undefined,
      };
    }
  }
  return null;
}

// ==================== Gitee URL Parsing ====================

interface ParsedGiteeUrl {
  owner: string;
  repo: string;
  branch?: string;
  subPath?: string;
}

export function parseGiteeUrl(url: string): ParsedGiteeUrl | null {
  const patterns = [
    /^https?:\/\/gitee\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)$/,
    /^https?:\/\/gitee\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/?$/,
    /^https?:\/\/gitee\.com\/([^/]+)\/([^/]+)\/?$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const [, owner, repo, branch, subPath] = match;
      return {
        owner,
        repo: repo.replace(/\.git$/, ''),
        branch: branch || undefined,
        subPath: subPath || undefined,
      };
    }
  }
  return null;
}

// ==================== GitLab URL Parsing ====================

interface ParsedGitLabUrl {
  host: string;
  projectPath: string;
  branch?: string;
  subPath?: string;
}

export function parseGitLabUrl(url: string): ParsedGitLabUrl | null {
  // https://gitlab.com/group/project/-/tree/branch/path
  const pattern = /^https?:\/\/([^/]+)\/(.+?)\/-\/tree\/([^/]+)(?:\/(.+))?$/;
  const simplePattern = /^https?:\/\/(gitlab\.[^/]+)\/(.+?)(?:\.git)?\/?$/;

  let match = url.match(pattern);
  if (match) {
    const [, host, projectPath, branch, subPath] = match;
    return { host, projectPath, branch, subPath };
  }

  match = url.match(simplePattern);
  if (match) {
    const [, host, projectPath] = match;
    return { host, projectPath };
  }
  return null;
}

// ==================== ClawHub URL Parsing ====================

interface ParsedClawHubUrl {
  owner: string;
  skill: string;
}

export function parseClawHubUrl(url: string): ParsedClawHubUrl | null {
  // https://clawhub.ai/owner/skill
  const pattern = /^https?:\/\/clawhub\.ai\/([^/]+)\/([^/]+)\/?$/;
  const match = url.match(pattern);
  if (match) {
    const [, owner, skill] = match;
    return { owner, skill };
  }
  return null;
}

// ==================== Bitbucket URL Parsing ====================

interface ParsedBitbucketUrl {
  owner: string;
  repo: string;
  branch?: string;
  subPath?: string;
}

export function parseBitbucketUrl(url: string): ParsedBitbucketUrl | null {
  const patterns = [
    /^https?:\/\/bitbucket\.org\/([^/]+)\/([^/]+)\/src\/([^/]+)\/(.+)$/,
    /^https?:\/\/bitbucket\.org\/([^/]+)\/([^/]+)\/src\/([^/]+)\/?$/,
    /^https?:\/\/bitbucket\.org\/([^/]+)\/([^/]+)\/?$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const [, owner, repo, branch, subPath] = match;
      return { owner, repo, branch, subPath };
    }
  }
  return null;
}

// ==================== GitHub API ====================

async function githubApiFetch(url: string, token?: string): Promise<any> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Skills-Manager/2.0',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(url, { headers });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('GitHub API rate limit exceeded. Please try again later.');
    }
    if (response.status === 404) {
      throw new Error('Repository or path not found. Please check the URL.');
    }
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function getGitHubRepoInfo(owner: string, repo: string, token?: string): Promise<RepoInfo> {
  const data = await githubApiFetch(`https://api.github.com/repos/${owner}/${repo}`, token);
  const branchesData = await githubApiFetch(`https://api.github.com/repos/${owner}/${repo}/branches?per_page=20`, token).catch(() => []);

  return {
    name: data.name,
    description: data.description || undefined,
    stars: data.stargazers_count,
    defaultBranch: data.default_branch,
    branches: Array.isArray(branchesData) ? branchesData.map((b: any) => b.name) : [],
    url: data.html_url,
  };
}

// ==================== ZIP Download (shared) ====================

/**
 * Download a ZIP archive from a URL, extract to targetDir, and return the
 * path of the single top-level directory inside the archive (most Git
 * hosting services wrap the repo in a single root folder like "repo-branch/").
 */
async function downloadRepoAsZip(
  zipUrl: string,
  targetDir: string,
  headers?: Record<string, string>,
): Promise<{ dir: string; contentDisposition?: string }> {
  const response = await fetch(zipUrl, {
    headers: { 'User-Agent': 'Skills-Manager/2.0', ...headers },
    redirect: 'follow',
    signal: AbortSignal.timeout(120_000), // 120s timeout
  });

  if (!response.ok) {
    throw new Error(`Failed to download ZIP: ${response.status} ${response.statusText}`);
  }

  const contentDisposition = response.headers.get('content-disposition') || undefined;

  const zipPath = path.join(targetDir, '_download.zip');
  const extractDir = path.join(targetDir, '_extracted');
  await fs.ensureDir(extractDir);

  // Write ZIP to disk
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(zipPath, buffer);

  // Extract using unzipper
  const unzipper = await import('unzipper');
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(zipPath)
      .pipe(unzipper.default.Extract({ path: extractDir }))
      .on('close', resolve)
      .on('error', reject);
  });

  // Remove the zip file
  await fs.remove(zipPath);

  // Most archives have a single top-level directory (e.g. "repo-branch/")
  const entries = await fs.readdir(extractDir);
  if (entries.length === 1) {
    const single = path.join(extractDir, entries[0]);
    const stat = await fs.stat(single);
    if (stat.isDirectory()) {
      return { dir: single, contentDisposition };
    }
  }
  return { dir: extractDir, contentDisposition };
}

// ==================== Gitee API ====================

async function giteeApiFetch(url: string, token?: string): Promise<any> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'Skills-Manager/2.0',
  };
  // Gitee uses access_token as query parameter
  const separator = url.includes('?') ? '&' : '?';
  const finalUrl = token ? `${url}${separator}access_token=${token}` : url;
  const response = await fetch(finalUrl, { headers });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Gitee repository or path not found.');
    }
    throw new Error(`Gitee API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function getGiteeRepoInfo(owner: string, repo: string, token?: string): Promise<RepoInfo> {
  const data = await giteeApiFetch(`https://gitee.com/api/v5/repos/${owner}/${repo}`, token);
  const branchesData = await giteeApiFetch(`https://gitee.com/api/v5/repos/${owner}/${repo}/branches?per_page=20`, token).catch(() => []);

  return {
    name: data.name,
    description: data.description || undefined,
    stars: data.stargazers_count,
    defaultBranch: data.default_branch,
    branches: Array.isArray(branchesData) ? branchesData.map((b: any) => b.name) : [],
    url: data.html_url,
  };
}

// ==================== GitLab API ====================

async function gitlabApiFetch(host: string, endpoint: string, token?: string): Promise<any> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'Skills-Manager/2.0',
  };
  if (token) {
    headers['PRIVATE-TOKEN'] = token;
  }
  const response = await fetch(`https://${host}/api/v4${endpoint}`, { headers });

  if (!response.ok) {
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function getGitLabRepoInfo(host: string, projectPath: string, token?: string): Promise<RepoInfo> {
  const encodedPath = encodeURIComponent(projectPath);
  const data = await gitlabApiFetch(host, `/projects/${encodedPath}`, token);
  const branchesData = await gitlabApiFetch(host, `/projects/${encodedPath}/repository/branches?per_page=20`, token).catch(() => []);

  return {
    name: data.name,
    description: data.description || undefined,
    stars: data.star_count,
    defaultBranch: data.default_branch,
    branches: Array.isArray(branchesData) ? branchesData.map((b: any) => b.name) : [],
    url: data.web_url,
  };
}

// ==================== Bitbucket API ====================

async function bitbucketApiFetch(url: string): Promise<any> {
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Skills-Manager/2.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Bitbucket API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function getBitbucketRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
  const data = await bitbucketApiFetch(`https://api.bitbucket.org/2.0/repositories/${owner}/${repo}`);
  const branchesData = await bitbucketApiFetch(`https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/refs/branches?pagelen=20`).catch(() => ({ values: [] }));

  return {
    name: data.name,
    description: data.description || undefined,
    defaultBranch: data.mainbranch?.name || 'main',
    branches: branchesData.values?.map((b: any) => b.name) || [],
    url: data.links?.html?.href || `https://bitbucket.org/${owner}/${repo}`,
  };
}

async function downloadBitbucketContents(
  owner: string,
  repo: string,
  dirPath: string,
  branch: string,
  targetDir: string
): Promise<void> {
  const apiPath = dirPath || '';
  const url = `https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/src/${branch}/${apiPath}?pagelen=100`;
  const data = await bitbucketApiFetch(url);

  if (!data.values) return;

  for (const item of data.values) {
    const relativePath = dirPath ? item.path.substring(dirPath.length + 1) : item.path;
    if (item.type === 'commit_file') {
      const fileUrl = `https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/src/${branch}/${item.path}`;
      const response = await fetch(fileUrl, {
        headers: { 'User-Agent': 'Skills-Manager/2.0' },
      });
      if (response.ok) {
        const content = await response.text();
        const filePath = path.join(targetDir, relativePath);
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, content, 'utf-8');
      }
    } else if (item.type === 'commit_directory') {
      const subDir = path.join(targetDir, relativePath);
      await fs.ensureDir(subDir);
      await downloadBitbucketContents(owner, repo, item.path, branch, targetDir);
    }
  }
}

// ==================== Skill Scanning ====================

export async function scanForSkills(dirPath: string): Promise<ScannedSkill[]> {
  const skills: ScannedSkill[] = [];

  if (!await fs.pathExists(dirPath)) return skills;

  // Check if dirPath itself is a skill (contains SKILL.md)
  const skillMdPath = path.join(dirPath, 'SKILL.md');
  if (await fs.pathExists(skillMdPath)) {
    const skill = await buildScannedSkill(dirPath);
    skills.push(skill);
    return skills;
  }

  // Track valid skill names to avoid duplicates
  const validSkillNames = new Set<string>();

  // Scan subdirectories for valid skills (with SKILL.md)
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

    const subDir = path.join(dirPath, entry.name);
    const subSkillMd = path.join(subDir, 'SKILL.md');

    if (await fs.pathExists(subSkillMd)) {
      const skill = await buildScannedSkill(subDir);
      skills.push(skill);
      validSkillNames.add(entry.name);
    } else {
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
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    if (validSkillNames.has(entry.name)) continue;

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

async function buildScannedSkill(dirPath: string): Promise<ScannedSkill> {
  const files = await collectFileList(dirPath);
  const skillMdPath = path.join(dirPath, 'SKILL.md');
  let description: string | undefined;

  try {
    const content = await fs.readFile(skillMdPath, 'utf-8');
    // Extract description from frontmatter or first paragraph
    const fmMatch = content.match(/^---\s*\n[\s\S]*?description:\s*(.+)\n[\s\S]*?\n---/);
    if (fmMatch) {
      description = fmMatch[1].trim();
    } else {
      // Try first non-heading paragraph
      const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
      if (lines.length > 0) {
        description = lines[0].trim().substring(0, 200);
      }
    }
  } catch { /* ignore */ }

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

async function collectFileList(dirPath: string): Promise<{ relativePath: string; size: number }[]> {
  const files: { relativePath: string; size: number }[] = [];

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

// ==================== Conflict Detection ====================

export async function checkConflicts(
  skillNames: string[],
  targetSourceDirId?: string
): Promise<{ name: string; existingPath: string }[]> {
  const config = await getConfig();
  let targetDir = '';

  if (targetSourceDirId && config.sourceDirs?.length > 0) {
    const found = config.sourceDirs.find(s => s.id === targetSourceDirId);
    if (found) targetDir = found.path;
  }
  if (!targetDir) {
    if (config.activeSourceDirId && config.sourceDirs?.length > 0) {
      const active = config.sourceDirs.find(s => s.id === config.activeSourceDirId);
      if (active) targetDir = active.path;
    }
    if (!targetDir) targetDir = config.sourceDir;
  }

  if (!targetDir) return [];

  const conflicts: { name: string; existingPath: string }[] = [];
  for (const name of skillNames) {
    const existingPath = path.join(targetDir, name);
    if (await fs.pathExists(existingPath)) {
      conflicts.push({ name, existingPath });
    }
  }

  return conflicts;
}

// ==================== Import Execution ====================

async function resolveTargetDir(targetSourceDirId?: string): Promise<string> {
  const config = await getConfig();
  let targetDir = '';

  if (targetSourceDirId && config.sourceDirs?.length > 0) {
    const found = config.sourceDirs.find(s => s.id === targetSourceDirId);
    if (found) targetDir = found.path;
  }
  if (!targetDir) {
    if (config.activeSourceDirId && config.sourceDirs?.length > 0) {
      const active = config.sourceDirs.find(s => s.id === config.activeSourceDirId);
      if (active) targetDir = active.path;
    }
    if (!targetDir) targetDir = config.sourceDir;
  }

  if (!targetDir) {
    throw new Error('No source directory configured. Please add a source directory first.');
  }

  return targetDir;
}

export async function executeImport(
  skills: ScannedSkill[],
  options: ImportOptions,
  source: ImportSource,
  sourceUrl?: string
): Promise<ImportResult> {
  const startTime = Date.now();
  const targetDir = await resolveTargetDir(options.targetSourceDirId);

  const result: ImportResult = {
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
            } catch { /* ignore snapshot errors */ }
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
            } catch { /* ignore */ }
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
            } catch { /* ignore */ }
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
        } catch { /* ignore snapshot errors */ }
      }

      result.successCount++;
      result.importedSkills.push({ name: skill.name, path: destPath });
    } catch (error) {
      result.failCount++;
      result.failedSkills.push({
        name: skill.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  result.duration = Date.now() - startTime;

  // Auto-sync to all bound projects after import (if enabled via options)
  if (result.successCount > 0 && (options as any).autoSyncAfterImport) {
    try {
      const config = await getConfig();
      if (config.projects.length > 0) {
        const projectIds = config.projects.map((p: any) => p.id);
        await syncLinks(projectIds, undefined, 'backup-replace', options.targetSourceDirId);
      }
    } catch {
      // Non-blocking: don't fail the import if auto-sync fails
    }
  }

  return result;
}

async function copySkillToTarget(sourcePath: string, destPath: string, mode: string): Promise<void> {
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

async function mergeSkillToTarget(sourcePath: string, destPath: string): Promise<void> {
  const entries = await fs.readdir(sourcePath, { withFileTypes: true });
  for (const entry of entries) {
    const srcItem = path.join(sourcePath, entry.name);
    const destItem = path.join(destPath, entry.name);

    if (entry.isDirectory()) {
      if (await fs.pathExists(destItem)) {
        await mergeSkillToTarget(srcItem, destItem);
      } else {
        await fs.copy(srcItem, destItem);
      }
    } else {
      if (!await fs.pathExists(destItem)) {
        await fs.copy(srcItem, destItem);
      }
      // Skip existing files in merge mode
    }
  }
}

// ==================== GitHub Import ====================

export async function scanGitHub(
  url: string,
  branch?: string,
  token?: string
): Promise<{ skills: ScannedSkill[]; repoInfo: RepoInfo }> {
  const parsed = parseGitHubUrl(url);
  if (!parsed) {
    throw new Error('Invalid GitHub URL. Expected format: https://github.com/owner/repo');
  }

  // Try to get repoInfo via API (only if token is available to avoid rate limit)
  let repoInfo: RepoInfo;
  let targetBranch = branch || parsed.branch;

  if (token) {
    // With token: use API to get accurate repo info
    repoInfo = await getGitHubRepoInfo(parsed.owner, parsed.repo, token);
    if (!targetBranch) targetBranch = repoInfo.defaultBranch;
  } else {
    // Without token: construct basic info from URL, skip API call entirely
    repoInfo = {
      name: parsed.repo,
      defaultBranch: 'main',
      url: `https://github.com/${parsed.owner}/${parsed.repo}`,
    };
    if (!targetBranch) targetBranch = 'main';
  }

  // Download repo as ZIP (no API rate limit)
  const tempDir = path.join(TEMP_DIR, `github-${uuidv4()}`);
  await fs.ensureDir(tempDir);

  try {
    const zipHeaders: Record<string, string> = {};
    if (token) zipHeaders['Authorization'] = `Bearer ${token}`;

    let repoDir: string;
    try {
      const zipUrl = `https://github.com/${parsed.owner}/${parsed.repo}/archive/refs/heads/${targetBranch}.zip`;
      const zipResult = await downloadRepoAsZip(zipUrl, tempDir, zipHeaders);
      repoDir = zipResult.dir;
    } catch {
      // If 'main' branch fails, try 'master' as fallback
      if (!branch && !parsed.branch && targetBranch === 'main') {
        targetBranch = 'master';
        repoInfo.defaultBranch = 'master';
        const fallbackUrl = `https://github.com/${parsed.owner}/${parsed.repo}/archive/refs/heads/master.zip`;
        const zipResult = await downloadRepoAsZip(fallbackUrl, tempDir, zipHeaders);
        repoDir = zipResult.dir;
      } else {
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
      if (active) targetDir = active.path;
    }

    if (targetDir) {
      for (const skill of skills) {
        const existingPath = path.join(targetDir, skill.name);
        skill.hasConflict = await fs.pathExists(existingPath);
      }
    }

    return { skills, repoInfo };
  } catch (error) {
    await fs.remove(tempDir).catch(() => {});
    throw error;
  }
}

export async function importFromGitHub(
  url: string,
  options: ImportOptions,
  branch?: string
): Promise<ImportResult> {
  const { skills } = await scanGitHub(url, branch);
  return executeImport(skills, options, 'github', url);
}

// ==================== Gitee Import ====================

export async function scanGitee(
  url: string,
  branch?: string,
  token?: string
): Promise<{ skills: ScannedSkill[]; repoInfo: RepoInfo }> {
  const parsed = parseGiteeUrl(url);
  if (!parsed) {
    throw new Error('Invalid Gitee URL. Expected format: https://gitee.com/owner/repo');
  }

  let repoInfo: RepoInfo;
  let targetBranch = branch || parsed.branch;

  if (token) {
    repoInfo = await getGiteeRepoInfo(parsed.owner, parsed.repo, token);
    if (!targetBranch) targetBranch = repoInfo.defaultBranch;
  } else {
    repoInfo = {
      name: parsed.repo,
      defaultBranch: 'master',
      url: `https://gitee.com/${parsed.owner}/${parsed.repo}`,
    };
    if (!targetBranch) targetBranch = 'master';
  }

  const tempDir = path.join(TEMP_DIR, `gitee-${uuidv4()}`);
  await fs.ensureDir(tempDir);

  try {
    // Gitee ZIP download URL
    let zipUrl = `https://gitee.com/${parsed.owner}/${parsed.repo}/repository/archive/${targetBranch}.zip`;
    if (token) {
      zipUrl += `?access_token=${token}`;
    }

    let repoDir: string;
    try {
      const zipResult = await downloadRepoAsZip(zipUrl, tempDir);
      repoDir = zipResult.dir;
    } catch {
      if (!branch && !parsed.branch && targetBranch === 'master') {
        targetBranch = 'main';
        repoInfo.defaultBranch = 'main';
        let fallbackUrl = `https://gitee.com/${parsed.owner}/${parsed.repo}/repository/archive/main.zip`;
        if (token) fallbackUrl += `?access_token=${token}`;
        const zipResult = await downloadRepoAsZip(fallbackUrl, tempDir);
        repoDir = zipResult.dir;
      } else {
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
      if (active) targetDir = active.path;
    }
    if (targetDir) {
      for (const skill of skills) {
        skill.hasConflict = await fs.pathExists(path.join(targetDir, skill.name));
      }
    }

    return { skills, repoInfo };
  } catch (error) {
    await fs.remove(tempDir).catch(() => {});
    throw error;
  }
}

export async function importFromGitee(url: string, options: ImportOptions, branch?: string): Promise<ImportResult> {
  const { skills } = await scanGitee(url, branch);
  return executeImport(skills, options, 'gitee', url);
}

// ==================== GitLab Import ====================

export async function scanGitLab(
  url: string,
  branch?: string,
  token?: string
): Promise<{ skills: ScannedSkill[]; repoInfo: RepoInfo }> {
  const parsed = parseGitLabUrl(url);
  if (!parsed) {
    throw new Error('Invalid GitLab URL.');
  }

  let repoInfo: RepoInfo;
  let targetBranch = branch || parsed.branch;

  if (token) {
    repoInfo = await getGitLabRepoInfo(parsed.host, parsed.projectPath, token);
    if (!targetBranch) targetBranch = repoInfo.defaultBranch;
  } else {
    const projectName = parsed.projectPath.split('/').pop() || parsed.projectPath;
    repoInfo = {
      name: projectName,
      defaultBranch: 'main',
      url: `https://${parsed.host}/${parsed.projectPath}`,
    };
    if (!targetBranch) targetBranch = 'main';
  }

  const tempDir = path.join(TEMP_DIR, `gitlab-${uuidv4()}`);
  await fs.ensureDir(tempDir);

  try {
    // GitLab ZIP download URL
    const encodedProject = encodeURIComponent(parsed.projectPath);
    const zipHeaders: Record<string, string> = {};
    if (token) zipHeaders['PRIVATE-TOKEN'] = token;

    let repoDir: string;
    try {
      const zipUrl = `https://${parsed.host}/api/v4/projects/${encodedProject}/repository/archive.zip?sha=${targetBranch}`;
      const zipResult = await downloadRepoAsZip(zipUrl, tempDir, zipHeaders);
      repoDir = zipResult.dir;
    } catch {
      if (!branch && !parsed.branch && targetBranch === 'main') {
        targetBranch = 'master';
        repoInfo.defaultBranch = 'master';
        const fallbackUrl = `https://${parsed.host}/api/v4/projects/${encodedProject}/repository/archive.zip?sha=master`;
        const zipResult = await downloadRepoAsZip(fallbackUrl, tempDir, zipHeaders);
        repoDir = zipResult.dir;
      } else {
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
      if (active) targetDir = active.path;
    }
    if (targetDir) {
      for (const skill of skills) {
        skill.hasConflict = await fs.pathExists(path.join(targetDir, skill.name));
      }
    }

    return { skills, repoInfo };
  } catch (error) {
    await fs.remove(tempDir).catch(() => {});
    throw error;
  }
}

export async function importFromGitLab(url: string, options: ImportOptions, branch?: string): Promise<ImportResult> {
  const { skills } = await scanGitLab(url, branch);
  return executeImport(skills, options, 'gitlab', url);
}

// ==================== Bitbucket Import ====================

export async function scanBitbucket(
  url: string,
  branch?: string
): Promise<{ skills: ScannedSkill[]; repoInfo: RepoInfo }> {
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
      if (active) targetDir = active.path;
    }
    if (targetDir) {
      for (const skill of skills) {
        skill.hasConflict = await fs.pathExists(path.join(targetDir, skill.name));
      }
    }

    return { skills, repoInfo };
  } catch (error) {
    await fs.remove(tempDir).catch(() => {});
    throw error;
  }
}

export async function importFromBitbucket(url: string, options: ImportOptions, branch?: string): Promise<ImportResult> {
  const { skills } = await scanBitbucket(url, branch);
  return executeImport(skills, options, 'bitbucket', url);
}

// ==================== ClawHub Import ====================

export async function scanClawHub(
  url: string,
): Promise<{ skills: ScannedSkill[]; repoInfo: RepoInfo }> {
  const parsed = parseClawHubUrl(url);
  if (!parsed) {
    throw new Error('Invalid ClawHub URL. Expected format: https://clawhub.ai/owner/skill');
  }

  const repoInfo: RepoInfo = {
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
      if (active) targetDir = active.path;
    }
    if (targetDir) {
      for (const skill of skills) {
        skill.hasConflict = await fs.pathExists(path.join(targetDir, skill.name));
      }
    }

    return { skills, repoInfo };
  } catch (error) {
    await fs.remove(tempDir).catch(() => {});
    throw error;
  }
}

export async function importFromClawHub(url: string, options: ImportOptions): Promise<ImportResult> {
  const { skills } = await scanClawHub(url);
  return executeImport(skills, options, 'clawhub', url);
}

// ==================== Local Import ====================

export async function scanLocal(sourcePath: string): Promise<{ skills: ScannedSkill[] }> {
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
    if (active) targetDir = active.path;
  }
  if (targetDir) {
    for (const skill of skills) {
      skill.hasConflict = await fs.pathExists(path.join(targetDir, skill.name));
    }
  }

  return { skills };
}

export async function importFromLocal(
  sourcePath: string,
  options: ImportOptions
): Promise<ImportResult> {
  const { skills } = await scanLocal(sourcePath);
  return executeImport(skills, options, 'local', sourcePath);
}

// ==================== ZIP Import ====================

export async function scanZip(zipPath: string): Promise<{ skills: ScannedSkill[]; tempDir: string }> {
  if (!await fs.pathExists(zipPath)) {
    throw new Error(`ZIP file not found: ${zipPath}`);
  }

  const tempDir = path.join(TEMP_DIR, `zip-${uuidv4()}`);
  await fs.ensureDir(tempDir);

  try {
    // Extract ZIP
    const unzipper = await import('unzipper');
    await new Promise<void>((resolve, reject) => {
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
      if (active) targetDir = active.path;
    }
    if (targetDir) {
      for (const skill of skills) {
        skill.hasConflict = await fs.pathExists(path.join(targetDir, skill.name));
      }
    }

    return { skills, tempDir };
  } catch (error) {
    await fs.remove(tempDir).catch(() => {});
    throw error;
  }
}

export async function importFromZip(
  zipPath: string,
  options: ImportOptions
): Promise<ImportResult> {
  const { skills, tempDir } = await scanZip(zipPath);
  const result = await executeImport(skills, options, 'zip', zipPath);

  // Clean up temp directory
  await fs.remove(tempDir).catch(() => {});

  return result;
}

// ==================== Clipboard Import ====================

export async function scanClipboard(content: string): Promise<{ skills: ScannedSkill[] }> {
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
    if (active) targetDir = active.path;
  }
  if (targetDir) {
    for (const skill of skills) {
      skill.hasConflict = await fs.pathExists(path.join(targetDir, skill.name));
    }
  }

  return { skills };
}

export async function importFromClipboard(
  content: string,
  options: ImportOptions
): Promise<ImportResult> {
  const { skills } = await scanClipboard(content);
  return executeImport(skills, options, 'clipboard');
}

// ==================== Batch Import ====================

export async function importBatch(
  urls: string[],
  options: ImportOptions
): Promise<ImportResult> {
  const startTime = Date.now();
  const mergedResult: ImportResult = {
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
    if (!trimmedUrl) continue;

    try {
      let subResult: ImportResult;

      if (trimmedUrl.includes('github.com')) {
        subResult = await importFromGitHub(trimmedUrl, options);
      } else if (trimmedUrl.includes('gitee.com')) {
        subResult = await importFromGitee(trimmedUrl, options);
      } else if (trimmedUrl.includes('gitlab.')) {
        subResult = await importFromGitLab(trimmedUrl, options);
      } else if (trimmedUrl.includes('bitbucket.org')) {
        subResult = await importFromBitbucket(trimmedUrl, options);
      } else {
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
    } catch (error) {
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

export async function importFromCSV(csvContent: string, options: ImportOptions): Promise<ImportResult> {
  // Parse CSV: each row is a URL or path
  const lines = csvContent.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  const urls: string[] = [];

  for (const line of lines) {
    // Support CSV with columns: url, name (optional)
    const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
    if (parts[0]) urls.push(parts[0]);
  }

  return importBatch(urls, options);
}

export async function importFromJSON(jsonContent: string, options: ImportOptions): Promise<ImportResult> {
  const data = JSON.parse(jsonContent);
  const urls: string[] = [];

  if (Array.isArray(data)) {
    for (const item of data) {
      if (typeof item === 'string') {
        urls.push(item);
      } else if (item.url) {
        urls.push(item.url);
      }
    }
  }

  return importBatch(urls, options);
}

export async function exportToCSV(): Promise<string> {
  // Read import history and generate CSV
  const historyPath = path.join(os.homedir(), '.skills-manager', 'import-history.json');
  if (!await fs.pathExists(historyPath)) return 'source,url,skill_name,timestamp,status\n';

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

export async function exportToJSON(): Promise<string> {
  const historyPath = path.join(os.homedir(), '.skills-manager', 'import-history.json');
  if (!await fs.pathExists(historyPath)) return '[]';

  const history = await fs.readJson(historyPath);
  return JSON.stringify(history, null, 2);
}

// ==================== Cleanup ====================

export async function cleanupTempFiles(): Promise<void> {
  if (await fs.pathExists(TEMP_DIR)) {
    await fs.remove(TEMP_DIR);
  }
}

// ==================== Auto-detect URL type ====================

export function detectUrlType(url: string): ImportSource | null {
  if (url.includes('github.com')) return 'github';
  if (url.includes('gitee.com')) return 'gitee';
  if (url.includes('gitlab.')) return 'gitlab';
  if (url.includes('bitbucket.org')) return 'bitbucket';
  if (url.includes('clawhub.ai')) return 'clawhub';
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