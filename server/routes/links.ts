import { Router, Request, Response } from 'express';
import { getConfig } from '../services/configService.js';
import { syncLinks, removeLinks, verifyAllLinks } from '../services/linkService.js';
import { getLinkInfo } from '../utils/symlink.js';
import fs from 'fs-extra';
import type { LinkStatus } from '../../src/types/index.js';

const router = Router();

// GET /api/links/status - Get all link statuses
// Checks each project path directly (is it a symlink? pointing where?)
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const config = await getConfig();
    const projects = await Promise.all(
      config.projects.map(async (project) => {
        const linkInfo = await getLinkInfo(project.path);

        let linkStatus: LinkStatus;
        let linkedTo: string | undefined;

        if (!linkInfo.exists) {
          linkStatus = 'missing';
        } else if (linkInfo.isSymlink) {
          const targetExists = linkInfo.linkedTo
            ? await fs.pathExists(linkInfo.linkedTo)
            : false;
          linkStatus = targetExists ? 'linked' : 'broken';
          linkedTo = linkInfo.linkedTo;
        } else if (linkInfo.isDirectory) {
          linkStatus = 'unlinked';
        } else {
          linkStatus = 'unlinked';
        }

        return {
          projectId: project.id,
          links: [{
            tool: project.name,
            status: linkStatus,
            targetPath: project.path,
            linkedTo,
          }],
        };
      })
    );
    res.json({ projects });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get link status' });
  }
});

// POST /api/links/sync - Sync links
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const { projectIds, tools, conflictStrategy, sourceDirId } = req.body;
    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      res.status(400).json({ error: 'projectIds array is required' });
      return;
    }
    const results = await syncLinks(projectIds, tools, conflictStrategy, sourceDirId);
    res.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sync links';
    res.status(500).json({ error: message });
  }
});

// POST /api/links/remove - Remove links
router.post('/remove', async (req: Request, res: Response) => {
  try {
    const { projectIds, tools, restoreAsDirectory } = req.body;
    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      res.status(400).json({ error: 'projectIds array is required' });
      return;
    }
    const results = await removeLinks(projectIds, tools, restoreAsDirectory);
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove links' });
  }
});

// POST /api/links/verify - Verify link validity
router.post('/verify', async (_req: Request, res: Response) => {
  try {
    const broken = await verifyAllLinks();
    res.json({ broken });
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify links' });
  }
});

export default router;
