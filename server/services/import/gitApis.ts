import fs from 'fs-extra';
import path from 'path';
import type { RepoInfo } from '../../../src/types/index.js';

// ==================== GitHub API ====================

export async function githubApiFetch(url: string, token?: string): Promise<any> {
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

export async function getGitHubRepoInfo(owner: string, repo: string, token?: string): Promise<RepoInfo> {
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
export async function downloadRepoAsZip(
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

export async function giteeApiFetch(url: string, token?: string): Promise<any> {
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

export async function getGiteeRepoInfo(owner: string, repo: string, token?: string): Promise<RepoInfo> {
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

export async function gitlabApiFetch(host: string, endpoint: string, token?: string): Promise<any> {
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

export async function getGitLabRepoInfo(host: string, projectPath: string, token?: string): Promise<RepoInfo> {
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

export async function bitbucketApiFetch(url: string): Promise<any> {
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

export async function getBitbucketRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
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

export async function downloadBitbucketContents(
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
