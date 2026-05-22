import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs-extra';
import { generateSkillCard } from '../services/skillCardService.js';
import {
  saveCard,
  listCards,
  getCard,
  getLatestForSkillPath,
  deleteCard,
} from '../services/cardStorageService.js';
import { getConfig } from '../services/configService.js';

async function getActiveSourceDir(): Promise<string> {
  const config = await getConfig();
  return config.sourceDir || '';
}

const router = Router();

// AI model creds are read server-side via getDefaultModelConfig (CLAUDE.md
// §红线 2). Persistence is opt-out via `persist: false`.
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { skillPath, includeAI, persist } = req.body || {};
    if (!skillPath || typeof skillPath !== 'string') {
      res.status(400).json({ error: 'skillPath is required' });
      return;
    }

    const absPath = path.isAbsolute(skillPath)
      ? skillPath
      : path.join(await getActiveSourceDir(), skillPath);

    let stat;
    try {
      stat = await fs.stat(absPath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        res.status(404).json({ error: `Skill directory not found: ${absPath}` });
        return;
      }
      throw err;
    }
    if (!stat.isDirectory()) {
      res.status(400).json({ error: 'skillPath must be a directory' });
      return;
    }

    const result = await generateSkillCard(absPath, {
      includeAI: includeAI !== false,
    });

    let cardId: string | undefined;
    let generatedAt: string | undefined;
    if (persist !== false) {
      const saved = await saveCard(absPath, result.html, result.data);
      cardId = saved.id;
      generatedAt = saved.generatedAt;
    }

    res.json({ ...result, cardId, generatedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Card generation failed';
    res.status(500).json({ error: message });
  }
});

// Summaries only (no html/data) — payload comes via GET /:id.
router.get('/list', async (_req: Request, res: Response) => {
  try {
    const cards = await listCards();
    res.json({ cards });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'List failed';
    res.status(500).json({ error: message });
  }
});

// Cache lookup for the dialog so reopening a skill skips a fresh AI call.
// pathGuard covers skillPath via PATH_FIELDS — out-of-roots is rejected upstream.
router.get('/by-path', async (req: Request, res: Response) => {
  try {
    const skillPath = req.query.skillPath;
    if (typeof skillPath !== 'string' || !skillPath) {
      res.status(400).json({ error: 'skillPath is required' });
      return;
    }
    const absPath = path.isAbsolute(skillPath)
      ? skillPath
      : path.join(await getActiveSourceDir(), skillPath);
    const card = await getLatestForSkillPath(absPath);
    res.json({ card });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lookup failed';
    res.status(500).json({ error: message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const card = await getCard(req.params.id as string);
    if (!card) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }
    res.json({ card });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Get failed';
    res.status(500).json({ error: message });
  }
});

// Raw HTML for new-tab opens. CSP sandbox header is a second layer behind
// escapeHtml at render time — defense in depth, not the primary defense.
router.get('/:id/view', async (req: Request, res: Response) => {
  try {
    const card = await getCard(req.params.id as string);
    if (!card) {
      res.status(404).send('Card not found');
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'self' 'unsafe-inline'");
    res.send(card.html);
  } catch {
    res.status(500).send('View failed');
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await deleteCard(req.params.id as string);
    res.json({ deleted });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Delete failed';
    res.status(500).json({ error: message });
  }
});

export default router;
