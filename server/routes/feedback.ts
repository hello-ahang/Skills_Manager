import { Router, Request, Response } from 'express';
import {
  submitFeedback,
  getFeedback,
  getFeedbackStats,
  deleteFeedback,
  clearAllFeedback,
} from '../services/feedbackService.js';

const router = Router();

/**
 * POST /api/feedback
 * Body: { skillName, skillPath, feedbackType, scenario, comment?, toolUsed, metadata? }
 * Submit a feedback entry.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { skillName, skillPath, feedbackType, scenario, comment, toolUsed, metadata } = req.body || {};

    if (!skillName || !skillPath || !feedbackType || !scenario || !toolUsed) {
      res.status(400).json({ error: 'skillName, skillPath, feedbackType, scenario, and toolUsed are required' });
      return;
    }

    const validTypes = ['effective', 'ineffective', 'partial', 'suggestion'];
    if (!validTypes.includes(feedbackType)) {
      res.status(400).json({ error: `feedbackType must be one of: ${validTypes.join(', ')}` });
      return;
    }

    const entry = await submitFeedback({
      skillName,
      skillPath,
      feedbackType,
      scenario,
      comment,
      toolUsed,
      metadata,
    });

    res.json({ feedback: entry });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit feedback';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/feedback
 * Query: ?skillPath=... (optional)
 * Get feedback entries, optionally filtered by skillPath.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const skillPath = req.query.skillPath as string | undefined;
    const entries = await getFeedback(skillPath);
    res.json({ feedback: entries });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get feedback';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/feedback/stats
 * Get aggregated feedback stats per skill.
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await getFeedbackStats();
    res.json({ stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get feedback stats';
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/feedback/:id
 * Delete a specific feedback entry.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await deleteFeedback(String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Feedback entry not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete feedback';
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/feedback?confirm=true
 * Clear ALL feedback data. Requires explicit `confirm=true` query param so
 * a stray DELETE doesn't wipe history. (CSRF + accidental click defense.)
 */
router.delete('/', async (req: Request, res: Response) => {
  try {
    if (req.query.confirm !== 'true') {
      res.status(400).json({ error: 'Refusing to clear all feedback without ?confirm=true' });
      return;
    }
    await clearAllFeedback();
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to clear feedback';
    res.status(500).json({ error: message });
  }
});

export default router;
