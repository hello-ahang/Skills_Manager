import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs-extra';
import { compareSkills } from '../services/compareService.js';
import { getConfig } from '../services/configService.js';

async function getActiveSourceDir(): Promise<string> {
  const config = await getConfig();
  return config.sourceDir || '';
}

const router = Router();

/**
 * POST /api/compare/skills
 * Body: { skillPathA: string, skillPathB: string, templateId?: string, includeAI?: boolean }
 * Compare two skills using the same Rubric template.
 *
 * AI model credentials are NEVER taken from the request — the server reads
 * them from user config when includeAI=true. This prevents SSRF and
 * Authorization-header leaks via attacker-supplied baseUrl.
 */
router.post('/skills', async (req: Request, res: Response) => {
  try {
    const { skillPathA, skillPathB, templateId, includeAI } = req.body || {};

    if (!skillPathA || !skillPathB) {
      res.status(400).json({ error: 'skillPathA and skillPathB are required' });
      return;
    }

    const sourceDir = await getActiveSourceDir();

    const absPathA = path.isAbsolute(skillPathA)
      ? skillPathA
      : path.join(sourceDir, skillPathA);
    const absPathB = path.isAbsolute(skillPathB)
      ? skillPathB
      : path.join(sourceDir, skillPathB);

    if (!await fs.pathExists(absPathA)) {
      res.status(404).json({ error: `Skill A not found: ${absPathA}` });
      return;
    }
    if (!await fs.pathExists(absPathB)) {
      res.status(404).json({ error: `Skill B not found: ${absPathB}` });
      return;
    }

    const report = await compareSkills({
      skillPathA: absPathA,
      skillPathB: absPathB,
      templateId,
      includeAI,
    });

    res.json({ report });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Compare failed';
    res.status(500).json({ error: message });
  }
});

export default router;
