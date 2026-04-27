import { Router } from 'express';
import path from 'path';
import { getConfig } from '../services/configService.js';
import { buildFileTree, readFileContent, writeFileContent, createNewFile, deleteFile, searchFiles, } from '../services/fileService.js';
import { recordEvent } from '../services/analyticsService.js';
const router = Router();
// GET /api/skills - Get skills file tree
// Supports optional ?sourceDirId= query param to specify which source dir to use
router.get('/', async (req, res) => {
    try {
        const config = await getConfig();
        const sourceDirId = req.query.sourceDirId;
        let targetDir = '';
        if (sourceDirId && config.sourceDirs?.length > 0) {
            const found = config.sourceDirs.find(s => s.id === sourceDirId);
            if (found)
                targetDir = found.path;
        }
        if (!targetDir) {
            // Fallback to active source dir or legacy sourceDir
            if (config.activeSourceDirId && config.sourceDirs?.length > 0) {
                const active = config.sourceDirs.find(s => s.id === config.activeSourceDirId);
                if (active)
                    targetDir = active.path;
            }
            if (!targetDir)
                targetDir = config.sourceDir;
        }
        if (!targetDir) {
            res.json({ tree: [], sourceDir: '' });
            return;
        }
        const tree = await buildFileTree(targetDir);
        // Inject version info from subscriptions into top-level skill directories
        try {
            const fs = await import('fs-extra');
            const os = await import('os');
            const subsPath = path.join(os.default.homedir(), '.skills-manager', 'subscriptions.json');
            if (await fs.default.pathExists(subsPath)) {
                const subs = await fs.default.readJson(subsPath);
                if (subs.length > 0) {
                    for (const node of tree) {
                        if (node.type === 'directory') {
                            const sub = subs.find((s) => s.skillName === node.name);
                            if (sub?.version || sub?.latestVersion) {
                                node.version = sub.version || sub.latestVersion;
                            }
                        }
                    }
                }
            }
        }
        catch { /* ignore subscription lookup errors */ }
        res.json({ tree, sourceDir: targetDir });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get skills tree' });
    }
});
// GET /api/skills/file - Get file content
router.get('/file', async (req, res) => {
    try {
        const filePath = req.query.path;
        if (!filePath) {
            res.status(400).json({ error: 'File path is required' });
            return;
        }
        const result = await readFileContent(filePath);
        res.json(result);
        // Analytics: only record view event for SKILL.md files (non-blocking)
        if (path.basename(filePath).toLowerCase() === 'skill.md') {
            recordEvent(filePath, '', 'view').catch(() => { });
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to read file';
        res.status(404).json({ error: message });
    }
});
// PUT /api/skills/file - Save file content
router.put('/file', async (req, res) => {
    try {
        const { path: filePath, content } = req.body;
        if (!filePath || content === undefined) {
            res.status(400).json({ error: 'File path and content are required' });
            return;
        }
        await writeFileContent(filePath, content);
        res.json({ success: true });
        // Analytics: record save event (non-blocking)
        recordEvent(filePath, '', 'save').catch(() => { });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to save file' });
    }
});
// POST /api/skills/file - Create new file
router.post('/file', async (req, res) => {
    try {
        const { path: filePath, content, templateId, variables } = req.body;
        if (!filePath) {
            res.status(400).json({ error: 'File path is required' });
            return;
        }
        let fileContent = content || '';
        // If templateId is provided, load template
        if (templateId) {
            const { getBuiltInTemplates } = await import('../services/templateService.js');
            const templates = getBuiltInTemplates();
            const template = templates.find(t => t.id === templateId);
            if (template) {
                fileContent = template.content;
                // Replace variables
                if (variables) {
                    for (const [key, value] of Object.entries(variables)) {
                        fileContent = fileContent.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
                    }
                }
            }
        }
        await createNewFile(filePath, fileContent);
        res.status(201).json({ success: true });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create file';
        res.status(400).json({ error: message });
    }
});
// DELETE /api/skills/file - Delete file
router.delete('/file', async (req, res) => {
    try {
        const filePath = req.query.path;
        if (!filePath) {
            res.status(400).json({ error: 'File path is required' });
            return;
        }
        await deleteFile(filePath);
        res.json({ success: true });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete file';
        res.status(404).json({ error: message });
    }
});
// GET /api/skills/search - Search files
// Supports optional ?sourceDirId= query param
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q;
        const sourceDirId = req.query.sourceDirId;
        if (!query) {
            res.status(400).json({ error: 'Search query is required' });
            return;
        }
        const config = await getConfig();
        // Resolve target directory (same logic as GET /api/skills)
        let targetDir = '';
        if (sourceDirId && config.sourceDirs?.length > 0) {
            const found = config.sourceDirs.find(s => s.id === sourceDirId);
            if (found)
                targetDir = found.path;
        }
        if (!targetDir) {
            if (config.activeSourceDirId && config.sourceDirs?.length > 0) {
                const active = config.sourceDirs.find(s => s.id === config.activeSourceDirId);
                if (active)
                    targetDir = active.path;
            }
            if (!targetDir)
                targetDir = config.sourceDir;
        }
        if (!targetDir) {
            res.json({ results: [] });
            return;
        }
        const results = await searchFiles(targetDir, query);
        res.json({ results });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to search files' });
    }
});
// GET /api/skills/templates - Get built-in templates
router.get('/templates', async (_req, res) => {
    try {
        const { getBuiltInTemplates } = await import('../services/templateService.js');
        const templates = getBuiltInTemplates();
        res.json({ templates });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get templates' });
    }
});
// PUT /api/skills/rename - Rename file or directory
router.put('/rename', async (req, res) => {
    try {
        const { oldPath, newName } = req.body;
        if (!oldPath || !newName) {
            res.status(400).json({ error: 'Old path and new name are required' });
            return;
        }
        const fs = await import('fs-extra');
        const path = await import('path');
        if (!await fs.default.pathExists(oldPath)) {
            res.status(404).json({ error: 'File or directory not found' });
            return;
        }
        // Validate new name (no path separators)
        if (newName.includes('/') || newName.includes('\\')) {
            res.status(400).json({ error: 'Name cannot contain path separators' });
            return;
        }
        const dir = path.default.dirname(oldPath);
        const newPath = path.default.join(dir, newName);
        if (await fs.default.pathExists(newPath)) {
            res.status(409).json({ error: 'A file or directory with that name already exists' });
            return;
        }
        await fs.default.rename(oldPath, newPath);
        res.json({ success: true, newPath });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to rename';
        res.status(500).json({ error: message });
    }
});
// DELETE /api/skills/directory - Delete directory
router.delete('/directory', async (req, res) => {
    try {
        const dirPath = req.query.path;
        if (!dirPath) {
            res.status(400).json({ error: 'Directory path is required' });
            return;
        }
        const fs = await import('fs-extra');
        if (!await fs.default.pathExists(dirPath)) {
            res.status(404).json({ error: 'Directory not found' });
            return;
        }
        const stat = await fs.default.stat(dirPath);
        if (!stat.isDirectory()) {
            res.status(400).json({ error: 'Path is not a directory' });
            return;
        }
        await fs.default.remove(dirPath);
        res.json({ success: true });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete directory';
        res.status(500).json({ error: message });
    }
});
// POST /api/skills/directory - Create new directory
router.post('/directory', async (req, res) => {
    try {
        const { path: dirPath } = req.body;
        if (!dirPath) {
            res.status(400).json({ error: 'Directory path is required' });
            return;
        }
        const fs = await import('fs-extra');
        if (await fs.default.pathExists(dirPath)) {
            res.status(409).json({ error: 'Directory already exists' });
            return;
        }
        await fs.default.ensureDir(dirPath);
        res.status(201).json({ success: true });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create directory';
        res.status(500).json({ error: message });
    }
});
// GET /api/skills/folder-contents - Read all text files in a directory recursively
router.get('/folder-contents', async (req, res) => {
    try {
        const fs = await import('fs-extra');
        const dirPath = req.query.path;
        if (!dirPath) {
            res.status(400).json({ error: 'Path is required' });
            return;
        }
        const stat = await fs.default.stat(dirPath);
        if (!stat.isDirectory()) {
            res.status(400).json({ error: 'Path is not a directory' });
            return;
        }
        const EXCLUDED = new Set(['.git', '.DS_Store', 'node_modules', '.skill-backup']);
        const BINARY_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.zip', '.tar', '.gz', '.pdf']);
        const files = [];
        async function readDirRecursive(currentPath, basePath) {
            const entries = await fs.default.readdir(currentPath, { withFileTypes: true });
            for (const entry of entries) {
                if (EXCLUDED.has(entry.name))
                    continue;
                const fullPath = `${currentPath}/${entry.name}`;
                const relativePath = fullPath.substring(basePath.length + 1);
                if (entry.isDirectory()) {
                    await readDirRecursive(fullPath, basePath);
                }
                else if (entry.isFile()) {
                    const ext = entry.name.substring(entry.name.lastIndexOf('.')).toLowerCase();
                    if (BINARY_EXTS.has(ext))
                        continue;
                    try {
                        const content = await fs.default.readFile(fullPath, 'utf-8');
                        files.push({ relativePath, content });
                    }
                    catch {
                        // Skip files that can't be read as text
                    }
                }
            }
        }
        await readDirRecursive(dirPath, dirPath);
        res.json({ files });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to read folder contents';
        res.status(500).json({ error: message });
    }
});
export default router;
