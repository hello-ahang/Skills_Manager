import type { ScannedSkill, RepoInfo } from '../../../src/types/index.js';

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
