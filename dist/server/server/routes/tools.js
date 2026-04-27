import { Router } from 'express';
import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';
import { convertFiles, validateMarkdown, computeDiff } from '../services/convertService.js';
import { recordEvent } from '../services/analyticsService.js';
const router = Router();
// POST /api/tools/convert - Format conversion
router.post('/convert', async (req, res) => {
    try {
        const { files, from, to, outputDir } = req.body;
        if (!files || !from || !to || !outputDir) {
            res.status(400).json({ error: 'files, from, to, and outputDir are required' });
            return;
        }
        const results = await convertFiles(files, from, to, outputDir);
        res.json({ results });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to convert files' });
    }
});
// POST /api/tools/validate - Markdown validation
router.post('/validate', async (req, res) => {
    try {
        const { paths } = req.body;
        if (!paths || !Array.isArray(paths)) {
            res.status(400).json({ error: 'paths array is required' });
            return;
        }
        const results = await Promise.all(paths.map(async (filePath) => {
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                const validation = validateMarkdown(content);
                return {
                    path: filePath,
                    ...validation,
                };
            }
            catch {
                return {
                    path: filePath,
                    valid: false,
                    errors: [{ line: 0, message: 'File not found or unreadable' }],
                    warnings: [],
                };
            }
        }));
        res.json({ results });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to validate files' });
    }
});
// POST /api/tools/export - Export as ZIP
router.post('/export', async (req, res) => {
    try {
        const { paths } = req.body;
        if (!paths || !Array.isArray(paths)) {
            res.status(400).json({ error: 'paths array is required' });
            return;
        }
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename=skills-export.zip');
        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(res);
        for (const filePath of paths) {
            if (await fs.pathExists(filePath)) {
                const stat = await fs.stat(filePath);
                if (stat.isDirectory()) {
                    archive.directory(filePath, path.basename(filePath));
                }
                else {
                    archive.file(filePath, { name: path.basename(filePath) });
                }
            }
        }
        await archive.finalize();
        // Analytics: record export event for each path (non-blocking)
        for (const p of paths) {
            recordEvent(p, '', 'export').catch(() => { });
        }
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to export files' });
    }
});
// POST /api/tools/diff - Diff comparison
router.post('/diff', async (req, res) => {
    try {
        const { file1, file2 } = req.body;
        if (!file1 || !file2) {
            res.status(400).json({ error: 'file1 and file2 are required' });
            return;
        }
        const [content1, content2] = await Promise.all([
            fs.readFile(file1, 'utf-8'),
            fs.readFile(file2, 'utf-8'),
        ]);
        const hunks = computeDiff(content1, content2);
        res.json({ hunks });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to compute diff' });
    }
});
export default router;
