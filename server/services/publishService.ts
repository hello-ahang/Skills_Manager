import type { LinkOperation } from '../../src/types/index.js';
import { syncLinks } from './linkService.js';
import { getConfig } from './configService.js';

// ==================== Publish Target Registry ====================

export interface PublishOptions {
  targetId: string;
  authToken?: string;
  metadata?: Record<string, string>;
  /** For symlink publish: project IDs to sync */
  projectIds?: string[];
  /** For symlink publish: source directory ID */
  sourceDirId?: string;
  /** For symlink publish: conflict strategy */
  conflictStrategy?: 'backup-replace' | 'skip';
}

export interface PublishResult {
  success: boolean;
  publishId?: string;
  status: 'published' | 'pending_review' | 'failed';
  message: string;
  url?: string;
  details?: LinkOperation[];
}

export interface PublishStatus {
  publishId: string;
  status: 'pending_review' | 'approved' | 'rejected';
  reviewComment?: string;
  updatedAt: string;
}

export interface PublishedSkill {
  id: string;
  skillName: string;
  skillPath: string;
  targetId: string;
  publishId: string;
  status: 'published' | 'pending_review' | 'approved' | 'rejected';
  publishedAt: string;
  url?: string;
}

export interface PublishTarget {
  /** 唯一标识符，如 'symlink', 'wukong' */
  id: string;
  /** 显示名称 */
  name: string;
  /** 图标名称（lucide-react 图标名） */
  icon: string;
  /** 分组：'builtin' | 'custom' */
  group: 'builtin' | 'custom';
  /** 发布方式描述 */
  description: string;
  /** 是否需要认证 */
  requiresAuth?: boolean;
  /** 认证配置字段定义 */
  authFields?: { key: string; label: string; type: 'text' | 'password'; placeholder?: string }[];
  /** 发布一个 Skill */
  publish: (skillPath: string, options: PublishOptions) => Promise<PublishResult>;
  /** 查询发布状态（用于审核类平台） */
  getStatus?: (publishId: string) => Promise<PublishStatus>;
  /** 获取已发布列表 */
  listPublished?: () => Promise<PublishedSkill[]>;
}

// Publish Target 注册表
const publishTargets: Map<string, PublishTarget> = new Map();

/** 注册一个发布目标 */
export function registerPublishTarget(target: PublishTarget): void {
  publishTargets.set(target.id, target);
}

/** 获取所有已注册的发布目标 */
export function getPublishTargets(): PublishTarget[] {
  return Array.from(publishTargets.values());
}

/** 根据 ID 获取发布目标 */
export function getPublishTarget(targetId: string): PublishTarget | undefined {
  return publishTargets.get(targetId);
}

// ==================== Register Built-in Publish Targets ====================

registerPublishTarget({
  id: 'symlink',
  name: 'Local Symlink Sync',
  icon: 'Link',
  group: 'builtin',
  description: 'Sync skills to project AI tool config directories via symlinks',

  async publish(skillPath: string, options: PublishOptions): Promise<PublishResult> {
    try {
      const config = await getConfig();
      const projectIds = options.projectIds || config.projects.map(p => p.id);

      if (projectIds.length === 0) {
        return {
          success: false,
          status: 'failed',
          message: 'No projects configured. Please add a project first.',
        };
      }

      const results = await syncLinks(
        projectIds,
        undefined,
        options.conflictStrategy || 'backup-replace',
        options.sourceDirId
      );

      const successCount = results.filter(r => r.status === 'success').length;
      const failCount = results.filter(r => r.status === 'failed').length;

      return {
        success: failCount === 0,
        status: failCount === 0 ? 'published' : 'failed',
        message: `Synced to ${successCount}/${results.length} projects${failCount > 0 ? ` (${failCount} failed)` : ''}`,
        details: results,
      };
    } catch (error) {
      return {
        success: false,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Failed to sync links',
      };
    }
  },
});
