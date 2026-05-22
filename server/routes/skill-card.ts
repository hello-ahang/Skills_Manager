import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs-extra';
import { generateSkillCard } from '../services/skillCardService.js';
import { getConfig } from '../services/configService.js';

async function getActiveSourceDir(): Promise<string> {
  const config = await getConfig();
  return config.sourceDir || '';
}

const router = Router();

/**
 * POST /api/skill-card/generate
 * Body: { skillPath: string, includeAI?: boolean }
 * Returns: { html: string, data: SkillCardData }
 *
 * AI model creds are read server-side (CLAUDE.md §红线 2 — never accept
 * baseUrl/apiKey from request body).
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { skillPath, includeAI } = req.body || {};
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
      res.status(400).json({ error: `skillPath must be a directory` });
      return;
    }

    const result = await generateSkillCard(absPath, {
      includeAI: includeAI !== false,
    });

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Card generation failed';
    res.status(500).json({ error: message });
  }
});

export default router;
