const API_BASE = '/api';

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(response.status, error.error || 'Request failed');
  }

  return response.json();
}

// ==================== Config API ====================

export const configApi = {
  get: () => request<any>('/config'),
  update: (data: any) => request<any>('/config', { method: 'PUT', body: data }),
  testModel: (data: { baseUrl: string; apiKey: string; modelName: string }) =>
    request<{ success: boolean; reply?: string; error?: string }>('/config/test-model', { method: 'POST', body: data }),
};

// ==================== Projects API ====================

export const projectsApi = {
  getAll: () => request<{ projects: any[] }>('/projects'),
  add: (data: { path: string; name?: string }) =>
    request<any>('/projects', { method: 'POST', body: data }),
  addBatch: (projects: { path: string; name?: string }[]) =>
    request<{ added: any[]; errors: { path: string; error: string }[] }>('/projects', { method: 'POST', body: { projects } }),
  autoDetect: () =>
    request<{ added: any[]; total: number }>('/projects/auto-detect', { method: 'POST' }),
  checkPaths: (paths: string[]) =>
    request<{ results: { path: string; exists: boolean }[] }>('/projects/check-paths', { method: 'POST', body: { paths } }),
  remove: (id: string) =>
    request<{ success: boolean }>(`/projects/${id}`, { method: 'DELETE' }),
  browse: (dirPath: string) =>
    request<{ tree: any[] }>(`/projects/browse?path=${encodeURIComponent(dirPath)}`),
};


// ==================== Skills API ====================

export const skillsApi = {
  getTree: (sourceDirId?: string) =>
    request<{ tree: any[]; sourceDir: string }>(
      sourceDirId ? `/skills?sourceDirId=${encodeURIComponent(sourceDirId)}` : '/skills'
    ),
  getFile: (path: string) =>
    request<{ content: string; updatedAt: string }>(`/skills/file?path=${encodeURIComponent(path)}`),
  saveFile: (path: string, content: string) =>
    request<{ success: boolean }>('/skills/file', { method: 'PUT', body: { path, content } }),
  createFile: (data: { path: string; content?: string; templateId?: string; variables?: Record<string, string> }) =>
    request<{ success: boolean }>('/skills/file', { method: 'POST', body: data }),
  deleteFile: (path: string) =>
    request<{ success: boolean }>(`/skills/file?path=${encodeURIComponent(path)}`, { method: 'DELETE' }),
  createDirectory: (path: string) =>
    request<{ success: boolean }>('/skills/directory', { method: 'POST', body: { path } }),
  deleteDirectory: (path: string) =>
    request<{ success: boolean }>(`/skills/directory?path=${encodeURIComponent(path)}`, { method: 'DELETE' }),
  rename: (oldPath: string, newName: string) =>
    request<{ success: boolean; newPath: string }>('/skills/rename', { method: 'PUT', body: { oldPath, newName } }),
  search: (query: string) =>
    request<{ results: any[] }>(`/skills/search?q=${encodeURIComponent(query)}`),
  getTemplates: () =>
    request<{ templates: any[] }>('/skills/templates'),
  getFolderContents: (path: string) =>
    request<{ files: { relativePath: string; content: string }[] }>(`/skills/folder-contents?path=${encodeURIComponent(path)}`),
};

// ==================== Links API ====================

export const linksApi = {
  getStatus: () => request<{ projects: any[] }>('/links/status'),
  sync: (data: { projectIds: string[]; tools?: string[]; conflictStrategy?: string; sourceDirId?: string }) =>
    request<{ results: any[] }>('/links/sync', { method: 'POST', body: data }),
  remove: (data: { projectIds: string[]; tools?: string[]; restoreAsDirectory?: boolean }) =>
    request<{ results: any[] }>('/links/remove', { method: 'POST', body: data }),
  verify: () =>
    request<{ broken: any[] }>('/links/verify', { method: 'POST' }),
};

// ==================== Tools API ====================

export const toolsApi = {
  convert: (data: { files: string[]; from: string; to: string; outputDir: string }) =>
    request<{ results: any[] }>('/tools/convert', { method: 'POST', body: data }),
  validate: (paths: string[]) =>
    request<{ results: any[] }>('/tools/validate', { method: 'POST', body: { paths } }),
  diff: (file1: string, file2: string) =>
    request<{ hunks: any[] }>('/tools/diff', { method: 'POST', body: { file1, file2 } }),
  exportFiles: async (paths: string[]): Promise<void> => {
    const response = await fetch(`${API_BASE}/tools/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    });
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'skills-export.zip';
    a.click();
    URL.revokeObjectURL(url);
  },
};

// ==================== Versions API ====================

export const versionsApi = {
  getHistory: (skillPath: string) =>
    request<{ versions: any[] }>(`/versions?skillPath=${encodeURIComponent(skillPath)}`),
  create: (skillPath: string, version: string, label?: string) =>
    request<{ version: any }>('/versions', { method: 'POST', body: { skillPath, version, label } }),
  getDetail: (id: string) =>
    request<{ version: any }>(`/versions/${id}`),
  restore: (id: string) =>
    request<{ success: boolean; backupVersionId?: string }>(`/versions/${id}/restore`, { method: 'POST' }),
  remove: (id: string) =>
    request<{ success: boolean }>(`/versions/${id}`, { method: 'DELETE' }),
  diff: (id: string) =>
    request<{ diffs: any[] }>(`/versions/${id}/diff`),
};

// ==================== Analytics API ====================

export const analyticsApi = {
  recordEvent: (data: { skillPath: string; skillName?: string; eventType: string; metadata?: Record<string, string> }) =>
    request<{ success: boolean }>('/analytics/event', { method: 'POST', body: data }),
  getDashboard: () =>
    request<any>('/analytics/dashboard'),
  getSkillStats: (skillPath: string) =>
    request<{ stats: any }>(`/analytics/skill?path=${encodeURIComponent(skillPath)}`),
  getRecentActivity: (limit: number = 30) =>
    request<{ events: any[] }>(`/analytics/recent?limit=${limit}`),
  clearAll: () =>
    request<{ success: boolean }>('/analytics', { method: 'DELETE' }),
};

// ==================== Import API ====================

export const importApi = {
  // Select local path (opens system file picker)
  selectPath: () =>
    request<{ path: string }>('/import/select-path', { method: 'POST' }),

  // Git tokens (stored in user local config)
  getGitTokens: () =>
    request<{ github: string; gitee: string; gitlab: string }>('/import/git-tokens'),
  saveGitTokens: (tokens: { github?: string; gitee?: string; gitlab?: string }) =>
    request<{ success: boolean }>('/import/git-tokens', { method: 'PUT', body: tokens }),

  // Scan endpoints
  scanGitHub: (url: string, branch?: string) =>
    request<{ skills: any[]; repoInfo: any }>('/import/scan/github', { method: 'POST', body: { url, branch } }),
  scanGitee: (url: string, branch?: string) =>
    request<{ skills: any[]; repoInfo: any }>('/import/scan/gitee', { method: 'POST', body: { url, branch } }),
  scanGitLab: (url: string, branch?: string) =>
    request<{ skills: any[]; repoInfo: any }>('/import/scan/gitlab', { method: 'POST', body: { url, branch } }),
  scanBitbucket: (url: string, branch?: string) =>
    request<{ skills: any[]; repoInfo: any }>('/import/scan/bitbucket', { method: 'POST', body: { url, branch } }),
  scanClawHub: (url: string, branch?: string) =>
    request<{ skills: any[]; repoInfo: any }>('/import/scan/clawhub', { method: 'POST', body: { url, branch } }),
  scanLocal: (path: string) =>
    request<{ skills: any[] }>('/import/scan/local', { method: 'POST', body: { path } }),
  scanClipboard: (content: string) =>
    request<{ skills: any[] }>('/import/scan/clipboard', { method: 'POST', body: { content } }),
  scanAuto: (url: string, branch?: string) =>
    request<{ skills: any[]; repoInfo?: any; sourceType: string }>('/import/scan/auto', { method: 'POST', body: { url, branch } }),

  // Upload
  uploadZip: async (file: File): Promise<{ tempPath: string; tempDir: string; skills: any[] }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/import/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new ApiError(response.status, error.error || 'Upload failed');
    }
    return response.json();
  },

  // Execute
  execute: (data: { source: string; skills: any[]; options: any; sourceUrl?: string; version?: string }) =>
    request<{ result: any }>('/import/execute', { method: 'POST', body: data }),

  // Execute with SSE progress
  executeWithProgress: (
    data: { source: string; skills: any[]; options: any; sourceUrl?: string; version?: string },
    onProgress: (event: { type: string; current?: number; total?: number; skillName?: string; result?: any; message?: string }) => void,
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      fetch(`${API_BASE}/import-stream/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(response => {
        if (!response.ok) {
          response.json().then(err => reject(new Error(err.error || 'Import failed'))).catch(() => reject(new Error('Import failed')));
          return;
        }
        const reader = response.body?.getReader();
        if (!reader) { reject(new Error('No response body')); return; }
        const decoder = new TextDecoder();
        let buffer = '';

        function read() {
          reader!.read().then(({ done, value }) => {
            if (done) { resolve(); return; }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const event = JSON.parse(line.slice(6));
                  onProgress(event);
                } catch { /* ignore parse errors */ }
              }
            }
            read();
          }).catch(reject);
        }
        read();
      }).catch(reject);
    });
  },

  // Batch
  batch: (urls: string[], options: any) =>
    request<{ result: any }>('/import/batch', { method: 'POST', body: { urls, options } }),

  // Conflict check
  checkConflict: (skillNames: string[], targetSourceDirId?: string) =>
    request<{ conflicts: any[] }>('/import/check-conflict', { method: 'POST', body: { skillNames, targetSourceDirId } }),

  // History
  getHistory: (source?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (source) params.set('source', source);
    if (limit) params.set('limit', String(limit));
    const qs = params.toString();
    return request<{ history: any[] }>(`/import/history${qs ? `?${qs}` : ''}`);
  },
  deleteHistory: (id: string) =>
    request<{ success: boolean }>(`/import/history/${id}`, { method: 'DELETE' }),
  clearHistory: () =>
    request<{ success: boolean }>('/import/history', { method: 'DELETE' }),

  // Subscriptions
  getSubscriptions: () =>
    request<{ subscriptions: any[] }>('/import/subscriptions'),
  subscribe: (data: { skillPath: string; skillName: string; source: string; sourceUrl: string; branch?: string; version?: string }) =>
    request<{ subscription: any }>('/import/subscribe', { method: 'POST', body: data }),
  unsubscribe: (skillPath: string) =>
    request<{ success: boolean }>('/import/subscribe', { method: 'DELETE', body: { skillPath } }),
  checkUpdate: (skillPath: string) =>
    request<{ hasUpdate: boolean; subscription: any; newFiles?: any[] }>('/import/check-update', { method: 'POST', body: { skillPath } }),
  applyUpdate: (skillPath: string) =>
    request<{ result: any }>('/import/apply-update', { method: 'POST', body: { skillPath } }),
  checkAllUpdates: () =>
    request<{ results: { id: string; skillName: string; hasUpdate: boolean; currentVersion?: string; latestVersion?: string }[] }>('/import/check-all-updates', { method: 'POST' }),
  setAutoUpdate: (enabled: boolean, interval?: string) =>
    request<{ success: boolean }>('/import/auto-update', { method: 'PUT', body: { enabled, interval } }),

  // CSV/JSON
  importCSV: (content: string, options: any) =>
    request<{ result: any }>('/import/import/csv', { method: 'POST', body: { content, options } }),
  importJSON: (content: string, options: any) =>
    request<{ result: any }>('/import/import/json', { method: 'POST', body: { content, options } }),
  exportCSV: async (): Promise<void> => {
    const response = await fetch(`${API_BASE}/import/export/csv`);
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-history.csv';
    a.click();
    URL.revokeObjectURL(url);
  },
  exportJSON: async (): Promise<void> => {
    const response = await fetch(`${API_BASE}/import/export/json`);
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-history.json';
    a.click();
    URL.revokeObjectURL(url);
  },

  // Stats
  getStats: () =>
    request<{ stats: any }>('/import/stats'),

  // Cleanup
  cleanup: () =>
    request<{ success: boolean }>('/import/cleanup', { method: 'POST' }),

  // Providers
  getProviders: () =>
    request<{ providers: any[] }>('/import/providers'),
  scanByProvider: (providerId: string, input: string, options?: Record<string, string>) =>
    request<{ skills: any[]; repoInfo?: any; providerId: string }>(`/import/scan/provider/${providerId}`, { method: 'POST', body: { input, options } }),
  scanAutoDetect: (url: string, options?: Record<string, string>) =>
    request<{ skills: any[]; repoInfo?: any; providerId: string }>('/import/scan/auto-detect', { method: 'POST', body: { url, options } }),

  // Extensions
  getExtensions: () =>
    request<{ extensions: { name: string; path: string }[]; directory: string }>('/import/extensions'),
  uploadExtension: async (file: File): Promise<{ success: boolean; name: string; path: string; replaced: boolean; message: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/import/extensions/upload`, { method: 'POST', body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Upload failed');
    }
    return res.json();
  },
  deleteExtension: (name: string) =>
    request<{ success: boolean; message: string }>(`/import/extensions/${encodeURIComponent(name)}`, { method: 'DELETE' }),
};

// ==================== Publish API ====================

export const publishApi = {
  getTargets: () =>
    request<{ targets: any[] }>('/publish/targets'),
  publish: (targetId: string, data: { skillPath: string; options?: any }) =>
    request<{ result: any }>(`/publish/${targetId}`, { method: 'POST', body: data }),
  getStatus: (targetId: string, publishId: string) =>
    request<any>(`/publish/${targetId}/status/${publishId}`),
  listPublished: (targetId: string) =>
    request<{ published: any[] }>(`/publish/${targetId}/list`),
};
