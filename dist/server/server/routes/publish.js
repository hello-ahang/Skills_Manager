import { Router } from 'express';
import { getPublishTargets, getPublishTarget } from '../services/publishService.js';
const router = Router();
// GET /api/publish/targets - Get all registered publish targets
router.get('/targets', async (_req, res) => {
    try {
        const targets = getPublishTargets().map(t => ({
            id: t.id,
            name: t.name,
            icon: t.icon,
            group: t.group,
            description: t.description,
            requiresAuth: t.requiresAuth,
            authFields: t.authFields,
        }));
        res.json({ targets });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get publish targets' });
    }
});
// POST /api/publish/:targetId - Publish a skill to a target
router.post('/:targetId', async (req, res) => {
    try {
        const targetId = req.params.targetId;
        const { skillPath, options } = req.body;
        if (!skillPath) {
            res.status(400).json({ error: 'skillPath is required' });
            return;
        }
        const target = getPublishTarget(targetId);
        if (!target) {
            res.status(404).json({ error: `Publish target "${targetId}" not found` });
            return;
        }
        const result = await target.publish(skillPath, {
            targetId,
            ...options,
        });
        res.json({ result });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to publish';
        res.status(500).json({ error: message });
    }
});
// GET /api/publish/:targetId/status/:publishId - Get publish status
router.get('/:targetId/status/:publishId', async (req, res) => {
    try {
        const targetId = req.params.targetId;
        const publishId = req.params.publishId;
        const target = getPublishTarget(targetId);
        if (!target) {
            res.status(404).json({ error: `Publish target "${targetId}" not found` });
            return;
        }
        if (!target.getStatus) {
            res.status(400).json({ error: `Publish target "${targetId}" does not support status tracking` });
            return;
        }
        const status = await target.getStatus(publishId);
        res.json(status);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get publish status';
        res.status(500).json({ error: message });
    }
});
// GET /api/publish/:targetId/list - Get published skills list
router.get('/:targetId/list', async (req, res) => {
    try {
        const targetId = req.params.targetId;
        const target = getPublishTarget(targetId);
        if (!target) {
            res.status(404).json({ error: `Publish target "${targetId}" not found` });
            return;
        }
        if (!target.listPublished) {
            res.json({ published: [] });
            return;
        }
        const published = await target.listPublished();
        res.json({ published });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to list published skills';
        res.status(500).json({ error: message });
    }
});
export default router;
