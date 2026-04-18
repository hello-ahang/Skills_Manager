import { Router, Request, Response } from 'express';
import {
  getVersionHistory,
  createVersion,
  getVersionDetail,
  restoreVersion,
  deleteVersion,
  diffVersion,
} from '../services/versionService.js';
import { recordEvent } from '../services/analyticsService.js';

const router = Router();

// GET /api/versions?skillPath=xxx — Get version history for a skill
router.get('/', async (req: Request, res: Response) => {
  try {
    const skillPath = req.query.skillPath as string;
    if (!skillPath) {
      res.status(400).json({ error: 'skillPath is required' });
      return;
    }
    const versions = await getVersionHistory(skillPath);
    res.json({ versions });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get version history';
    res.status(500).json({ error: message });
  }
});

// POST /api/versions — Create a new version
router.post('/', async (req: Request, res: Response) => {
  try {
    const { skillPath, version, label } = req.body;
    if (!skillPath || !version) {
      res.status(400).json({ error: 'skillPath and version are required' });
      return;
    }
    const created = await createVersion(skillPath, version, label);
    res.json({ version: created });
    // Analytics: record version-create event (non-blocking)
    recordEvent(skillPath, '', 'version-create', { version, label: label || '' }).catch(() => {});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create version';
    res.status(500).json({ error: message });
  }
});

// GET /api/versions/:id — Get version detail
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const detail = await getVersionDetail(id);
    if (!detail) {
      res.status(404).json({ error: 'Version not found' });
      return;
    }
    res.json({ version: detail });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get version detail';
    res.status(500).json({ error: message });
  }
});

// POST /api/versions/:id/restore — Restore a version
router.post('/:id/restore', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const result = await restoreVersion(id);
    res.json(result);
    // Analytics: record version-restore event (non-blocking)
    recordEvent(id, '', 'version-restore').catch(() => {});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to restore version';
    res.status(500).json({ error: message });
  }
});

// DELETE /api/versions/:id — Delete a version
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await deleteVersion(id);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete version';
    res.status(500).json({ error: message });
  }
});

// GET /api/versions/:id/diff — Diff current vs version
router.get('/:id/diff', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const diffs = await diffVersion(id);
    res.json({ diffs });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to diff version';
    res.status(500).json({ error: message });
  }
});

export default router;
