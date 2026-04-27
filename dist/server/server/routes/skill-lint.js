import { Router } from 'express';
import path from 'path';
import fs from 'fs-extra';
import { generateHealthReport, aiAssessDescription, getSkillDescription, } from '../services/skillLintService.js';
import { getConfig } from '../services/configService.js';
async function getActiveSourceDir() {
    const config = await getConfig();
    return config.sourceDir || '';
}
const router = Router();
/**
 * POST /api/skill-lint/check
 * Body: { skillPath: string }  // 绝对路径或相对源目录的路径
 * Lint a single skill and return health report.
 */
router.post('/check', async (req, res) => {
    try {
        const { skillPath } = req.body || {};
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
        const skillName = path.basename(absPath);
        const report = await generateHealthReport(skillName, absPath);
        res.json({ report });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Lint failed';
        res.status(500).json({ error: message });
    }
});
/**
 * POST /api/skill-lint/batch
 * Body: { sourceDirPath?: string, includeAiAssess?: boolean, baseUrl?, apiKey?, modelName? }
 * Lint all top-level skill directories in source dir.
 * When includeAiAssess is true and model config is provided, also runs AI assessment for each Skill.
 */
router.post('/batch', async (req, res) => {
    try {
        const { sourceDirPath, includeAiAssess, baseUrl, apiKey, modelName } = req.body || {};
        const baseDir = sourceDirPath || (await getActiveSourceDir());
        if (!baseDir || !await fs.pathExists(baseDir)) {
            res.status(404).json({ error: `Source directory not found: ${baseDir}` });
            return;
        }
        // Build optional AI model config
        const aiModelConfig = (includeAiAssess && baseUrl && apiKey && modelName)
            ? { baseUrl, apiKey, modelName }
            : undefined;
        const entries = await fs.readdir(baseDir, { withFileTypes: true });
        // Collect valid skill directories first
        const skillEntries = [];
        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name.startsWith('.'))
                continue;
            const skillDir = path.join(baseDir, entry.name);
            const skillMd = path.join(skillDir, 'SKILL.md');
            if (await fs.pathExists(skillMd)) {
                skillEntries.push({ name: entry.name, dir: skillDir });
            }
        }
        // Phase 1: Run static lint for all skills (fast, no concurrency limit needed)
        const reports = [];
        for (const { name: skillName, dir: skillDir } of skillEntries) {
            try {
                const report = await generateHealthReport(skillName, skillDir);
                reports.push(report);
            }
            catch (e) {
                reports.push({
                    skillName,
                    skillPath: skillDir,
                    score: 0,
                    grade: 'F',
                    issues: [{
                            level: 'error',
                            rule: 'lint-internal-error',
                            message: `检测失败: ${e instanceof Error ? e.message : String(e)}`,
                        }],
                    metrics: {
                        descLength: 0, fileSize: 0, refsCount: 0,
                        hasFrontmatter: false, hasName: false, hasDescription: false,
                    },
                });
            }
        }
        // Phase 2: If AI assess requested, call aiAssessDescription directly (skip redundant static lint)
        // Concurrency limit of 3 to avoid overloading model API
        if (aiModelConfig) {
            const CONCURRENCY = 3;
            const reportsWithDesc = reports.filter(r => r.metrics.hasDescription);
            for (let i = 0; i < reportsWithDesc.length; i += CONCURRENCY) {
                const batch = reportsWithDesc.slice(i, i + CONCURRENCY);
                const aiResults = await Promise.allSettled(batch.map(async (report) => {
                    try {
                        const desc = await getSkillDescription(report.skillPath);
                        if (!desc)
                            return { skillPath: report.skillPath, aiAssessment: undefined };
                        const assessment = await aiAssessDescription(report.skillName, desc, aiModelConfig);
                        return { skillPath: report.skillPath, aiAssessment: assessment };
                    }
                    catch {
                        return { skillPath: report.skillPath, aiAssessment: undefined };
                    }
                }));
                for (const result of aiResults) {
                    if (result.status === 'fulfilled' && result.value.aiAssessment) {
                        const target = reports.find(r => r.skillPath === result.value.skillPath);
                        if (target)
                            target.aiAssessment = result.value.aiAssessment;
                    }
                }
            }
        }
        // 排序：分数低的优先
        reports.sort((a, b) => a.score - b.score);
        res.json({ reports, total: reports.length });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Batch lint failed';
        res.status(500).json({ error: message });
    }
});
/**
 * POST /api/skill-lint/ai-assess
 * Body: { skillName, description, baseUrl, apiKey, modelName }
 * AI evaluate description quality (token consuming).
 */
router.post('/ai-assess', async (req, res) => {
    try {
        const { skillName, description, baseUrl, apiKey, modelName } = req.body || {};
        if (!skillName || !description || !baseUrl || !apiKey || !modelName) {
            res.status(400).json({ error: 'skillName, description, baseUrl, apiKey, modelName are all required' });
            return;
        }
        const assessment = await aiAssessDescription(skillName, description, { baseUrl, apiKey, modelName });
        res.json({ assessment });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'AI assessment failed';
        res.status(500).json({ error: message });
    }
});
export default router;
