import { Router, Request, Response } from 'express';
import fs from 'fs-extra';
import path from 'path';
import { getConfig, updateConfig } from '../services/configService.js';

const router = Router();

// GET /api/config - Get global config
router.get('/', async (_req: Request, res: Response) => {
  try {
    const config = await getConfig();
    res.json({
      sourceDir: config.sourceDir,
      sourceDirs: config.sourceDirs,
      activeSourceDirId: config.activeSourceDirId,
      defaultModelId: config.defaultModelId || '',
      llmModels: config.llmModels || [],
      tools: config.tools,
      preferences: config.preferences,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read config' });
  }
});

// PUT /api/config - Update config
router.put('/', async (req: Request, res: Response) => {
  try {
    const { sourceDir, sourceDirs, activeSourceDirId, defaultModelId, llmModels, tools, preferences } = req.body;
    const config = await updateConfig({ sourceDir, sourceDirs, activeSourceDirId, defaultModelId, llmModels, tools, preferences });
    res.json({
      sourceDir: config.sourceDir,
      sourceDirs: config.sourceDirs,
      activeSourceDirId: config.activeSourceDirId,
      defaultModelId: config.defaultModelId || '',
      llmModels: config.llmModels || [],
      tools: config.tools,
      preferences: config.preferences,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update config' });
  }
});

// POST /api/config/test-model - Test LLM model connection
router.post('/test-model', async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey, modelName } = req.body;
    if (!baseUrl || !apiKey || !modelName) {
      res.status(400).json({ error: 'baseUrl, apiKey, and modelName are required' });
      return;
    }

    // Call OpenAI-compatible chat completions endpoint
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: 'Hi, respond with "ok" only.' }],
        max_tokens: 10,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      res.status(400).json({ success: false, error: `API returned ${response.status}: ${errorText}` });
      return;
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content || '';
    res.json({ success: true, reply: reply.trim() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed';
    res.status(400).json({ success: false, error: message });
  }
});

// POST /api/config/chat - Proxy AI chat completions (avoids CORS)
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey, modelName, messages, max_tokens } = req.body;
    if (!baseUrl || !apiKey || !modelName || !messages) {
      res.status(400).json({ error: 'baseUrl, apiKey, modelName, and messages are required' });
      return;
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        max_tokens: max_tokens || 16384,
      }),
      signal: AbortSignal.timeout(180000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      res.status(response.status).json({ error: `API returned ${response.status}: ${errorText}` });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chat request failed';
    res.status(500).json({ error: message });
  }
});

// GET /api/config/readme - Get README.md content
router.get('/readme', async (_req: Request, res: Response) => {
  try {
    const readmePath = path.resolve(process.cwd(), 'README.md');
    if (await fs.pathExists(readmePath)) {
      const content = await fs.readFile(readmePath, 'utf-8');
      res.json({ content });
    } else {
      res.status(404).json({ error: 'README.md not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to read README.md' });
  }
});

// GET /api/config/changelog - Get CHANGELOG.md content
router.get('/changelog', async (_req: Request, res: Response) => {
  try {
    const changelogPath = path.resolve(process.cwd(), 'CHANGELOG.md');
    if (await fs.pathExists(changelogPath)) {
      const content = await fs.readFile(changelogPath, 'utf-8');
      res.json({ content });
    } else {
      res.status(404).json({ error: 'CHANGELOG.md not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to read CHANGELOG.md' });
  }
});

export default router;
