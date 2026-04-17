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
