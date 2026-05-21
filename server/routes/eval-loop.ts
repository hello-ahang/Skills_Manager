import { Router, Request, Response } from 'express';
import {
  startEvalLoop,
  stopEvalLoop,
  getEvalHistory,
  getActiveLoops,
} from '../services/evalLoopService.js';

const router = Router();

/**
 * POST /api/eval-loop/start
 * Body: { skillPath, targetScore?, maxRounds?, minImprovement?, templateId?, baseUrl, apiKey, modelName }
 * SSE streaming endpoint — sends round progress and final result as server-sent events.
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    const {
      skillPath,
      targetScore,
      maxRounds,
      minImprovement,
      templateId,
      baseUrl,
      apiKey,
      modelName,
    } = req.body || {};

    if (!skillPath || typeof skillPath !== 'string') {
      res.status(400).json({ error: 'skillPath is required' });
      return;
    }
    if (!baseUrl || !apiKey || !modelName) {
      res.status(400).json({ error: 'baseUrl, apiKey, and modelName are required' });
      return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const config = {
      skillPath,
      targetScore: targetScore ?? 85,
      maxRounds: maxRounds ?? 5,
      minImprovement: minImprovement ?? 2,
      templateId,
    };

    const aiModelConfig = { baseUrl, apiKey, modelName };

    let loopId: string | undefined;
    let aborted = false;

    req.on('close', () => {
      aborted = true;
      if (loopId) {
        stopEvalLoop(loopId);
      }
    });

    const result = await startEvalLoop(config, aiModelConfig, (round, currentLoopId) => {
      if (aborted) return;
      if (!loopId) {
        loopId = currentLoopId;
      }
      res.write(`event: round\ndata: ${JSON.stringify(round)}\n\n`);
    });

    if (!aborted) {
      res.write(`event: complete\ndata: ${JSON.stringify(result)}\n\n`);
      res.end();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Eval loop failed';
    // If headers already sent (SSE started), send error event; otherwise return JSON
    if (res.headersSent) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: message });
    }
  }
});

/**
 * POST /api/eval-loop/stop
 * Body: { loopId: string }
 * Stop an active eval loop.
 */
router.post('/stop', async (req: Request, res: Response) => {
  try {
    const { loopId } = req.body || {};
    if (!loopId || typeof loopId !== 'string') {
      res.status(400).json({ error: 'loopId is required' });
      return;
    }

    const success = stopEvalLoop(loopId);
    res.json({ success });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to stop eval loop';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/eval-loop/history
 * Query: skillPath? (optional filter)
 * Return eval loop history.
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const skillPath = req.query.skillPath as string | undefined;
    const history = await getEvalHistory(skillPath);
    res.json({ history });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get eval history';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/eval-loop/active
 * Return all active (in-progress) eval loops.
 */
router.get('/active', async (_req: Request, res: Response) => {
  try {
    const loops = getActiveLoops();
    res.json({ loops });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get active loops';
    res.status(500).json({ error: message });
  }
});

export default router;
