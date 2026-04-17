import type { LinkOperation } from '../../src/types/index.js';
import { getConfig } from './configService.js';
import { createSymlink, removeSymlink, verifySymlink, getLinkInfo } from '../utils/symlink.js';

/**
 * Sync links: create symlinks from a source directory to each project's path directly.
 * Each project path (e.g. ~/.claude/skills) will become a symlink pointing to the source dir.
 * @param sourceDirId - ID of the source directory to link from. If not provided, falls back to activeSourceDirId.
 */
export async function syncLinks(
  projectIds: string[],
  _tools?: string[],
  conflictStrategy: 'backup-replace' | 'skip' = 'backup-replace',
  sourceDirId?: string
): Promise<LinkOperation[]> {
  const config = await getConfig();
  const results: LinkOperation[] = [];

  // Resolve source directory path
  let sourcePath = '';
  if (sourceDirId) {
    const sourceDir = config.sourceDirs?.find(s => s.id === sourceDirId);
    if (sourceDir) {
      sourcePath = sourceDir.path;
    }
  }
  if (!sourcePath) {
    // Fallback to active source dir or legacy sourceDir
    if (config.activeSourceDirId && config.sourceDirs?.length > 0) {
      const active = config.sourceDirs.find(s => s.id === config.activeSourceDirId);
      if (active) sourcePath = active.path;
    }
    if (!sourcePath) sourcePath = config.sourceDir;
  }

  if (!sourcePath) {
    throw new Error('Source directory not configured. Please add a source directory first.');
  }

  for (const projectId of projectIds) {
    const project = config.projects.find(p => p.id === projectId);
    if (!project) {
      results.push({
        projectId,
        projectPath: '',
        tool: '',
        sourcePath,
        targetPath: '',
        action: 'create',
        status: 'failed',
        error: `Project not found: ${projectId}`,
      });
      continue;
    }

    // Link directly: sourcePath -> project.path
    const targetPath = project.path;
    const operation: LinkOperation = {
      projectId,
      projectPath: project.path,
      tool: project.name,
      sourcePath,
      targetPath,
      action: 'create',
      status: 'pending',
    };

    try {
      const linkInfo = await getLinkInfo(targetPath);

      if (linkInfo.exists && linkInfo.isDirectory && !linkInfo.isSymlink) {
        if (conflictStrategy === 'skip') {
          operation.status = 'conflict';
          operation.error = 'Target directory already exists (skipped)';
          results.push(operation);
          continue;
        }
        // backup-replace: createSymlink handles backup
      }

      await createSymlink({
        source: sourcePath,
        target: targetPath,
        backup: conflictStrategy === 'backup-replace',
      });

      operation.status = 'success';
    } catch (error) {
      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : String(error);
    }

    results.push(operation);
  }

  return results;
}

/**
 * Remove links: remove symlinks at each project's path, restoring from backup if available.
 */
export async function removeLinks(
  projectIds: string[],
  _tools?: string[],
  restoreAsDirectory: boolean = false
): Promise<LinkOperation[]> {
  const config = await getConfig();
  const results: LinkOperation[] = [];

  for (const projectId of projectIds) {
    const project = config.projects.find(p => p.id === projectId);
    if (!project) continue;

    const targetPath = project.path;
    const operation: LinkOperation = {
      projectId,
      projectPath: project.path,
      tool: project.name,
      sourcePath: config.sourceDir,
      targetPath,
      action: 'remove',
      status: 'pending',
    };

    try {
      await removeSymlink(targetPath, restoreAsDirectory);
      operation.status = 'success';
    } catch (error) {
      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : String(error);
    }

    results.push(operation);
  }

  return results;
}

/**
 * Verify all project links are valid symlinks pointing to existing targets.
 */
export async function verifyAllLinks(): Promise<{ projectId: string; tool: string; path: string }[]> {
  const config = await getConfig();
  const broken: { projectId: string; tool: string; path: string }[] = [];

  for (const project of config.projects) {
    const linkInfo = await getLinkInfo(project.path);

    if (linkInfo.isSymlink) {
      const isValid = await verifySymlink(project.path);
      if (!isValid) {
        broken.push({
          projectId: project.id,
          tool: project.name,
          path: project.path,
        });
      }
    }
  }

  return broken;
}
