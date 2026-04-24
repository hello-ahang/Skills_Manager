import { Router, Request, Response } from 'express';
import {
  runSandboxTest,
  autoGenerateCases,
  loadSandboxHistory,
  saveSandboxHistory,
  clearSandboxHistory,
  aggregateResults,
  type SandboxHistoryEntry,
  type SandboxTestCase,
  type SandboxSkillInput,
} from '../services/sandboxService.js';

const router = Router();

/**
 * POST /api/sandbox/test
 * Body: { cases, skills, baseUrl, apiKey, modelName, assessMatch? }
 * Run sandbox test for given cases against given skills.
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { cases, skills, baseUrl, apiKey, modelName, assessMatch = true, saveHistory = true, mode } = req.body || {};
    const validMode: 'manual' | 'ai-generated' | undefined =
      mode === 'manual' || mode === 'ai-generated' ? mode : undefined;
    if (!Array.isArray(cases) || cases.length === 0) {
      res.status(400).json({ error: 'cases (non-empty array) is required' });
      return;
    }
    if (!Array.isArray(skills) || skills.length === 0) {
      res.status(400).json({ error: 'skills (non-empty array) is required' });
      return;
    }
    if (!baseUrl || !apiKey || !modelName) {
      res.status(400).json({ error: 'baseUrl, apiKey, modelName are required' });
      return;
    }

    // 校验 cases 结构
    const validCases: SandboxTestCase[] = cases
      .filter((c: any) => c && typeof c.scenario === 'string' && typeof c.expectedSkill === 'string')
      .map((c: any) => ({ scenario: c.scenario.trim(), expectedSkill: c.expectedSkill.trim() }));
    if (validCases.length === 0) {
      res.status(400).json({ error: 'No valid test cases (each requires scenario + expectedSkill)' });
      return;
    }

    const validSkills: SandboxSkillInput[] = skills
      .filter((s: any) => s && typeof s.name === 'string')
      .map((s: any) => ({
        name: s.name,
        description: s.description,
        contentSummary: s.contentSummary,
      }));

    const results = await runSandboxTest({
      cases: validCases,
      skills: validSkills,
      modelConfig: { baseUrl, apiKey, modelName },
      assessMatch,
    });

    const { triggerAccuracy, avgMatchScore } = aggregateResults(results);

    // 保存历史
    if (saveHistory) {
      const entry: SandboxHistoryEntry = {
        id: `sandbox-${Date.now()}`,
        timestamp: Date.now(),
        modelName,
        mode: validMode,
        cases: validCases,
        results,
        triggerAccuracy,
        avgMatchScore,
      };
      try {
        await saveSandboxHistory(entry);
      } catch {
        // 历史保存失败不影响返回
      }
    }

    res.json({ results, triggerAccuracy, avgMatchScore });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sandbox test failed';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/sandbox/auto-generate-cases
 * Body: { skill: { name, description }, baseUrl, apiKey, modelName, count? }
 * AI generates test scenarios for a given skill.
 */
router.post('/auto-generate-cases', async (req: Request, res: Response) => {
  try {
    const { skill, baseUrl, apiKey, modelName, count = 3 } = req.body || {};
    if (!skill || typeof skill.name !== 'string') {
      res.status(400).json({ error: 'skill.name is required' });
      return;
    }
    if (!baseUrl || !apiKey || !modelName) {
      res.status(400).json({ error: 'baseUrl, apiKey, modelName are required' });
      return;
    }

    const cases = await autoGenerateCases(
      { name: skill.name, description: skill.description, contentSummary: skill.contentSummary },
      { baseUrl, apiKey, modelName },
      Math.min(Math.max(count, 1), 10)
    );
    res.json({ cases });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Auto-generate failed';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/sandbox/history - load test history
 */
router.get('/history', async (_req: Request, res: Response) => {
  try {
    const history = await loadSandboxHistory();
    res.json({ history });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load history';
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/sandbox/history - clear test history
 */
router.delete('/history', async (_req: Request, res: Response) => {
  try {
    await clearSandboxHistory();
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to clear history';
    res.status(500).json({ error: message });
  }
});

export default router;
