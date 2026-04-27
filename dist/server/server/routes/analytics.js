import { Router } from 'express';
import { recordEvent, getDashboard, getSkillStats, getRecentActivity, clearAll, } from '../services/analyticsService.js';
const router = Router();
// POST /api/analytics/event — Record a usage event
router.post('/event', async (req, res) => {
    try {
        const { skillPath, skillName, eventType, metadata } = req.body;
        if (!skillPath || !eventType) {
            res.status(400).json({ error: 'skillPath and eventType are required' });
            return;
        }
        await recordEvent(skillPath, skillName || '', eventType, metadata);
        res.json({ success: true });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to record event';
        res.status(500).json({ error: message });
    }
});
// GET /api/analytics/dashboard — Get dashboard data
router.get('/dashboard', async (_req, res) => {
    try {
        const dashboard = await getDashboard();
        res.json(dashboard);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get dashboard';
        res.status(500).json({ error: message });
    }
});
// GET /api/analytics/skill?path=xxx — Get single skill stats
router.get('/skill', async (req, res) => {
    try {
        const skillPath = req.query.path;
        if (!skillPath) {
            res.status(400).json({ error: 'path is required' });
            return;
        }
        const stats = await getSkillStats(skillPath);
        if (!stats) {
            res.json({ stats: null });
            return;
        }
        res.json({ stats });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get skill stats';
        res.status(500).json({ error: message });
    }
});
// GET /api/analytics/recent?limit=30 — Get recent activity
router.get('/recent', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 30;
        const events = await getRecentActivity(limit);
        res.json({ events });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get recent activity';
        res.status(500).json({ error: message });
    }
});
// DELETE /api/analytics — Clear all analytics data
router.delete('/', async (_req, res) => {
    try {
        await clearAll();
        res.json({ success: true });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to clear analytics';
        res.status(500).json({ error: message });
    }
});
export default router;
