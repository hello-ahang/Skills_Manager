import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs-extra';
import {
  evaluateSkill,
  loadRubricTemplates,
  saveRubricTemplate,
  getDefaultRubricTemplate,
} from '../services/rubricService.js';
import { getConfig, getDefaultModelConfig } from '../services/configService.js';
import { updateRubricCacheEntry } from '../services/radarService.js';

async function getActiveSourceDir(): Promise<string> {
  const config = await getConfig();
  return config.sourceDir || '';
}

const router = Router();

/**
 * POST /api/skill-rubric/evaluate
 * Body: { skillPath: string, templateId?: string, includeAI?: boolean }
 * Evaluate a single skill using rubric and return report.
 *
 * AI model creds are read server-side from user config; never accepted from
 * the request body (SSRF + Authorization header leak — same threat model
 * fixed in compare/fresh).
 */
router.post('/evaluate', async (req: Request, res: Response) => {
  try {
    const { skillPath, templateId, includeAI } = req.body || {};
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

    const aiModelConfig = includeAI ? (await getDefaultModelConfig()) ?? undefined : undefined;

    const skillName = path.basename(absPath);
    const report = await evaluateSkill(skillName, absPath, {
      templateId: templateId || undefined,
      aiModelConfig,
    });

    // Auto-update Rubric cache for radar ranking
    if (report && report.overallScore != null && report.grade) {
      updateRubricCacheEntry(skillName, {
        grade: report.grade,
        score: report.overallScore,
        evaluatedAt: report.evaluatedAt || new Date().toISOString(),
      }).catch(() => { /* silent */ });
    }

    res.json({ report });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Rubric evaluation failed';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/skill-rubric/batch
 * Body: { sourceDirPath?: string, templateId?: string, includeAI?: boolean }
 * Evaluate all top-level skill directories in source dir using rubric.
 * AI evaluation is optional, concurrency limited to 3.
 *
 * AI creds are read server-side (same SSRF defense as /evaluate above).
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { sourceDirPath, templateId, includeAI } = req.body || {};
    const baseDir = sourceDirPath || (await getActiveSourceDir());

    if (!baseDir || !await fs.pathExists(baseDir)) {
      res.status(404).json({ error: `Source directory not found: ${baseDir}` });
      return;
    }

    const aiModelConfig = includeAI ? (await getDefaultModelConfig()) ?? undefined : undefined;

    const entries = await fs.readdir(baseDir, { withFileTypes: true });

    // Collect valid skill directories (containing SKILL.md)
    const skillDirs: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const skillDir = path.join(baseDir, entry.name);
      const skillMd = path.join(skillDir, 'SKILL.md');
      if (await fs.pathExists(skillMd)) {
        skillDirs.push(skillDir);
      }
    }

    // Evaluate with concurrency limit of 3
    const CONCURRENCY = 3;
    const reports: Awaited<ReturnType<typeof evaluateSkill>>[] = [];

    for (let i = 0; i < skillDirs.length; i += CONCURRENCY) {
      const batch = skillDirs.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(skillDir => {
          const skillName = path.basename(skillDir);
          return evaluateSkill(skillName, skillDir, {
            templateId: templateId || undefined,
            aiModelConfig,
          });
        })
      );
      for (const result of results) {
        if (result.status === 'fulfilled') {
          reports.push(result.value);
        }
      }
    }

    // Sort by overallScore ascending (lowest first)
    reports.sort((a, b) => (a.overallScore ?? 0) - (b.overallScore ?? 0));
    res.json({ reports, total: reports.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Batch rubric evaluation failed';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/skill-rubric/templates
 * Return all available rubric templates (built-in + custom).
 */
router.get('/templates', async (_req: Request, res: Response) => {
  try {
    const defaultTemplate = getDefaultRubricTemplate();
    const customTemplates = await loadRubricTemplates();
    res.json({ templates: [defaultTemplate, ...customTemplates] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load templates';
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/skill-rubric/templates
 * Body: RubricTemplate object
 * Save a custom rubric template.
 */
router.put('/templates', async (req: Request, res: Response) => {
  try {
    const templateData = req.body;
    if (!templateData || !templateData.id || !templateData.name) {
      res.status(400).json({ error: 'Template id and name are required' });
      return;
    }

    await saveRubricTemplate(templateData);
    res.json({ success: true, template: templateData });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save template';
    res.status(500).json({ error: message });
  }
});

export default router;
