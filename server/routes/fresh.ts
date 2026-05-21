import { Router, Request, Response } from 'express';
import {
  checkFreshness,
  batchCheckFreshness,
  generateFreshSuggestions,
} from '../services/freshService.js';

const router = Router();

/**
 * POST /api/fresh/check
 * Body: { skillPath }
 * Check freshness of a single Skill.
 */
router.post('/check', async (req: Request, res: Response) => {
  try {
    const { skillPath } = req.body || {};
    if (!skillPath) {
      res.status(400).json({ error: 'skillPath is required' });
      return;
    }
    const report = await checkFreshness(skillPath);
    res.json({ report });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to check freshness';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/fresh/batch
 * Body: { skillPaths }
 * Batch check freshness for multiple Skills.
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { skillPaths } = req.body || {};
    if (!Array.isArray(skillPaths) || skillPaths.length === 0) {
      res.status(400).json({ error: 'skillPaths array is required' });
      return;
    }
    const reports = await batchCheckFreshness(skillPaths);
    res.json({ reports });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to batch check freshness';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/fresh/suggestions
 * Body: { skillPath }
 * Generate freshness improvement suggestions. AI model config is read
 * server-side from user config — never accept baseUrl/apiKey from clients
 * (SSRF + credential leak risk).
 */
router.post('/suggestions', async (req: Request, res: Response) => {
  try {
    const { skillPath } = req.body || {};
    if (!skillPath) {
      res.status(400).json({ error: 'skillPath is required' });
      return;
    }
    const result = await generateFreshSuggestions(skillPath);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate suggestions';
    res.status(500).json({ error: message });
  }
});

export default router;
