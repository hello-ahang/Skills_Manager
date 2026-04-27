import { Router } from 'express';
import { aggregateAllSkills, loadRadarTags, saveRadarTags, loadRadarSummary, saveRadarSummary } from '../services/radarService.js';
const router = Router();
// GET /api/radar/skills - Aggregate all Skills from library + projects + import history
router.get('/skills', async (_req, res) => {
    try {
        const skills = await aggregateAllSkills();
        res.json({ skills });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to aggregate skills';
        res.status(500).json({ error: message });
    }
});
// POST /api/radar/search - AI semantic search: find matching Skills for a scenario
router.post('/search', async (req, res) => {
    try {
        const { query, skills, baseUrl, apiKey, modelName } = req.body;
        if (!query || !skills || !baseUrl || !apiKey || !modelName) {
            res.status(400).json({ error: 'query, skills, baseUrl, apiKey, and modelName are required' });
            return;
        }
        const skillsList = skills
            .map((s) => `- ${s.name}: ${s.description || s.contentSummary || '无描述'}`)
            .join('\n');
        const messages = [
            {
                role: 'system',
                content: `你是一个 Skills 匹配助手。用户描述了一个使用场景，请从以下 Skills 列表中找出最匹配的 Skills。

Skills 列表：
${skillsList}

请返回 JSON 格式（不要包含 markdown 代码块标记）：
[
  { "name": "skill-name", "score": 0.95, "reason": "匹配理由" }
]
只返回匹配度 > 0.3 的结果，按匹配度降序排列，最多返回 10 个。如果没有匹配的 Skill，返回空数组 []。`,
            },
            {
                role: 'user',
                content: query,
            },
        ];
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: modelName,
                messages,
                max_tokens: 4096,
            }),
            signal: AbortSignal.timeout(60000),
        });
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            res.status(response.status).json({ error: `AI API returned ${response.status}: ${errorText}` });
            return;
        }
        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content || '[]';
        // Parse JSON from AI response (handle possible markdown code blocks)
        let results;
        try {
            const jsonStr = content.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
            results = JSON.parse(jsonStr);
        }
        catch {
            results = [];
        }
        res.json({ results });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Search failed';
        res.status(500).json({ error: message });
    }
});
// POST /api/radar/summary - AI capability summary: categorize all Skills
router.post('/summary', async (req, res) => {
    try {
        const { skills, baseUrl, apiKey, modelName } = req.body;
        if (!skills || !baseUrl || !apiKey || !modelName) {
            res.status(400).json({ error: 'skills, baseUrl, apiKey, and modelName are required' });
            return;
        }
        const skillsList = skills
            .map((s) => `- ${s.name}: ${s.description || '无描述'}`)
            .join('\n');
        const messages = [
            {
                role: 'system',
                content: `你是一个 Skills 分析助手。请分析以下 Skills 列表，按功能领域进行分类，生成能力总览。

Skills 列表：
${skillsList}

请返回 JSON 格式（不要包含 markdown 代码块标记）：
{
  "categories": [
    { "name": "分类名称", "count": 5, "skills": ["skill1", "skill2"], "description": "该分类的能力描述" }
  ],
  "totalCount": 25,
  "summary": "一句话总结所有 Skills 的能力覆盖情况"
}

分类要求：
- 分类名称简洁（2-6个字），如：代码开发、旅行规划、文档处理、数据分析、AI工具、项目管理
- 每个 Skill 只归入一个最匹配的分类
- 按 count 降序排列`,
            },
            {
                role: 'user',
                content: '请分析这些 Skills 并生成能力总览。',
            },
        ];
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: modelName,
                messages,
                max_tokens: 8192,
            }),
            signal: AbortSignal.timeout(180000),
        });
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            res.status(response.status).json({ error: `AI API returned ${response.status}: ${errorText}` });
            return;
        }
        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content || '{}';
        let summary;
        try {
            const jsonStr = content.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
            summary = JSON.parse(jsonStr);
        }
        catch {
            summary = { categories: [], totalCount: 0, summary: 'AI 返回格式解析失败' };
        }
        res.json({ summary });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Summary generation failed';
        res.status(500).json({ error: message });
    }
});
// POST /api/radar/tags - AI auto-tagging: generate tags for Skills
router.post('/tags', async (req, res) => {
    try {
        const { skills, baseUrl, apiKey, modelName } = req.body;
        if (!skills || !baseUrl || !apiKey || !modelName) {
            res.status(400).json({ error: 'skills, baseUrl, apiKey, and modelName are required' });
            return;
        }
        const skillsList = skills
            .map((s) => `- ${s.name}: ${s.description || '无描述'}`)
            .join('\n');
        const messages = [
            {
                role: 'system',
                content: `你是一个 Skills 标签生成助手。请为以下每个 Skill 生成 2-4 个分类标签。

Skills：
${skillsList}

请返回 JSON 格式（不要包含 markdown 代码块标记）：
{
  "skill-name-1": ["标签1", "标签2"],
  "skill-name-2": ["标签1", "标签2", "标签3"]
}

标签要求：
- 简洁（2-4个字）
- 如：代码审查、旅行规划、文档生成、数据分析、PPT制作、AI工具、项目管理、Git工作流、技能管理、图片生成`,
            },
            {
                role: 'user',
                content: '请为这些 Skills 生成标签。',
            },
        ];
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: modelName,
                messages,
                max_tokens: 8192,
            }),
            signal: AbortSignal.timeout(180000),
        });
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            res.status(response.status).json({ error: `AI API returned ${response.status}: ${errorText}` });
            return;
        }
        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content || '{}';
        let tags;
        try {
            const jsonStr = content.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
            tags = JSON.parse(jsonStr);
        }
        catch {
            tags = {};
        }
        res.json({ tags });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Tag generation failed';
        res.status(500).json({ error: message });
    }
});
// ==================== Local Cache API ====================
// GET /api/radar/cache/tags - Load tags from local file
router.get('/cache/tags', async (_req, res) => {
    try {
        const tags = await loadRadarTags();
        res.json({ tags });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load tags';
        res.status(500).json({ error: message });
    }
});
// PUT /api/radar/cache/tags - Save tags to local file
router.put('/cache/tags', async (req, res) => {
    try {
        const { tags } = req.body;
        if (!tags || typeof tags !== 'object') {
            res.status(400).json({ error: 'tags object is required' });
            return;
        }
        await saveRadarTags(tags);
        res.json({ success: true });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save tags';
        res.status(500).json({ error: message });
    }
});
// GET /api/radar/cache/summary - Load summary from local file
router.get('/cache/summary', async (_req, res) => {
    try {
        const summary = await loadRadarSummary();
        res.json({ summary });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load summary';
        res.status(500).json({ error: message });
    }
});
// PUT /api/radar/cache/summary - Save summary to local file
router.put('/cache/summary', async (req, res) => {
    try {
        const { summary } = req.body;
        if (!summary || typeof summary !== 'object') {
            res.status(400).json({ error: 'summary object is required' });
            return;
        }
        await saveRadarSummary(summary);
        res.json({ success: true });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save summary';
        res.status(500).json({ error: message });
    }
});
export default router;
