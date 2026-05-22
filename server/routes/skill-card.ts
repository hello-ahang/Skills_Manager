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

/**
 * POST /api/skill-card/generate
 * Body: { skillPath: string, includeAI?: boolean, persist?: boolean }
 * Returns: { html, data, cardId?, generatedAt? }
 *
 * AI model creds are read server-side (CLAUDE.md §红线 2).
 * Saved cards live in ~/.skills-manager/cards/ (see cardStorageService).
 */
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

    if (!await fs.pathExists(absPath)) {
      res.status(404).json({ error: `Skill directory not found: ${absPath}` });
      return;
    }

    const stat = await fs.stat(absPath);
    if (!stat.isDirectory()) {
      res.status(400).json({ error: 'skillPath must be a directory' });
      return;
    }

    const result = await generateSkillCard(absPath, {
      includeAI: includeAI !== false,
    });

    // Persistence is default-on; callers can opt out with persist: false.
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

/**
 * GET /api/skill-card/list
 * Returns: { cards: CardSummary[] }
 * Cards are newest first; payload (html/data) NOT included.
 */
router.get('/list', async (_req: Request, res: Response) => {
  try {
    const cards = await listCards();
    res.json({ cards });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'List failed';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/skill-card/by-path?skillPath=...
 * Returns: { card: StoredCard | null }
 * Used by the dialog to show "last generated" instantly without paying
 * AI cost again.
 *
 * pathGuard runs over skillPath via PATH_FIELDS, so an out-of-roots query
 * returns 403 before we hit this handler.
 */
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

/**
 * GET /api/skill-card/:id
 * Returns: { card: StoredCard }
 * id must match uuid v4 pattern (validated in cardStorageService).
 */
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

/**
 * GET /api/skill-card/:id/view
 * Returns the raw HTML of a stored card so it can be opened directly in
 * a new browser tab. CSP sandbox header neutralizes any inline script
 * even though all user content is already escapeHtml-ed in the renderer.
 */
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

/**
 * DELETE /api/skill-card/:id
 * Returns: { deleted: boolean }
 */
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
