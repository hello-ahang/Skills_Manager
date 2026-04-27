import { syncLinks } from './linkService.js';
import { getConfig } from './configService.js';
// Publish Target 注册表
const publishTargets = new Map();
/** 注册一个发布目标 */
export function registerPublishTarget(target) {
    publishTargets.set(target.id, target);
}
/** 获取所有已注册的发布目标 */
export function getPublishTargets() {
    return Array.from(publishTargets.values());
}
/** 根据 ID 获取发布目标 */
export function getPublishTarget(targetId) {
    return publishTargets.get(targetId);
}
// ==================== Register Built-in Publish Targets ====================
registerPublishTarget({
    id: 'symlink',
    name: 'Local Symlink Sync',
    icon: 'Link',
    group: 'builtin',
    description: 'Sync skills to project AI tool config directories via symlinks',
    async publish(skillPath, options) {
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
            const results = await syncLinks(projectIds, undefined, options.conflictStrategy || 'backup-replace', options.sourceDirId);
            const successCount = results.filter(r => r.status === 'success').length;
            const failCount = results.filter(r => r.status === 'failed').length;
            return {
                success: failCount === 0,
                status: failCount === 0 ? 'published' : 'failed',
                message: `Synced to ${successCount}/${results.length} projects${failCount > 0 ? ` (${failCount} failed)` : ''}`,
                details: results,
            };
        }
        catch (error) {
            return {
                success: false,
                status: 'failed',
                message: error instanceof Error ? error.message : 'Failed to sync links',
            };
        }
    },
});
