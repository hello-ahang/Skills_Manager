// ==================== URL Parsing ====================
export function parseGitHubUrl(url) {
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
export function parseGiteeUrl(url) {
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
export function parseGitLabUrl(url) {
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
export function parseClawHubUrl(url) {
    // https://clawhub.ai/owner/skill
    const pattern = /^https?:\/\/clawhub\.ai\/([^/]+)\/([^/]+)\/?$/;
    const match = url.match(pattern);
    if (match) {
        const [, owner, skill] = match;
        return { owner, skill };
    }
    return null;
}
export function parseBitbucketUrl(url) {
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
