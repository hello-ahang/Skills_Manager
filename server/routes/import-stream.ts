import { Router, Request, Response } from 'express';
import {
  executeImport,
} from '../services/importService.js';
import type { ImportOptions, ScannedSkill, ImportSource } from '../../src/types/index.js';

const router = Router();

/**
 * POST /api/import-stream/execute - Execute import with real-time progress via SSE.
 *
 * The client receives Server-Sent Events with progress updates:
 *   data: {"type":"progress","current":1,"total":5,"skillName":"my-skill"}
 *   data: {"type":"complete","result":{...}}
 *   data: {"type":"error","message":"..."}
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { source, skills, options, sourceUrl } = req.body as {
      source: string;
      skills: ScannedSkill[];
      options: ImportOptions;
      sourceUrl?: string;
    };

    if (!skills || !Array.isArray(skills) || skills.length === 0) {
      res.status(400).json({ error: 'Skills array is required' });
      return;
    }

    if (!options) {
      res.status(400).json({ error: 'Import options are required' });
      return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const selectedSkills = skills.filter(s => s.selected);
    const total = selectedSkills.length;
    let current = 0;

    // Send progress for each skill as it's processed
    for (const skill of selectedSkills) {
      current++;
      const progressData = JSON.stringify({
        type: 'progress',
        current,
        total,
        skillName: skill.name,
      });
      res.write(`data: ${progressData}\n\n`);
    }

    // Execute the actual import
    const result = await executeImport(skills, options, source as ImportSource, sourceUrl);

    // Record import history (with version if available)
    try {
      const { addHistory } = await import('../services/importHistoryService.js');
      await addHistory({
        id: '',
        source: source as ImportSource,
        sourceUrl,
        timestamp: new Date().toISOString(),
        result,
        version: req.body.version || undefined,
      });
    } catch { /* ignore history errors */ }

    // Send completion event
    const completeData = JSON.stringify({ type: 'complete', result });
    res.write(`data: ${completeData}\n\n`);
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to execute import';

    // If headers already sent (SSE mode), send error as event
    if (res.headersSent) {
      const errorData = JSON.stringify({ type: 'error', message });
      res.write(`data: ${errorData}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: message });
    }
  }
});

export default router;
