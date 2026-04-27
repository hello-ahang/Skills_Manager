// ==================== URL Parsing ====================

// ---- GitHub ----

export interface ParsedGitHubUrl {
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

// ---- Gitee ----

export interface ParsedGiteeUrl {
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

// ---- GitLab ----

export interface ParsedGitLabUrl {
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

// ---- ClawHub ----

export interface ParsedClawHubUrl {
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

// ---- Bitbucket ----

export interface ParsedBitbucketUrl {
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
