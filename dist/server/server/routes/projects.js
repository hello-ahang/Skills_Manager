import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { getConfig, saveConfig } from '../services/configService.js';
import { buildFileTree } from '../services/fileService.js';
import { parseYamlField } from '../utils/yamlUtils.js';
const router = Router();
// Expand ~ to home directory
function expandHome(p) {
    if (p.startsWith('~/') || p === '~') {
        return path.join(os.homedir(), p.slice(1));
    }
    return p;
}
/**
 * Parse YAML frontmatter from a SKILL.md file content.
 * Returns { name, description } or null if no valid frontmatter found.
 */
function parseSkillFrontmatter(content) {
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match)
        return null;
    const frontmatter = match[1];
    const result = {};
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    if (nameMatch)
        result.name = nameMatch[1].trim().replace(/^['"]|['"]$/g, '');
    result.description = parseYamlField(frontmatter, 'description');
    return (result.name || result.description) ? result : null;
}
// GET /api/projects - Get all projects with their top-level files
router.get('/', async (_req, res) => {
    try {
        const config = await getConfig();
        // Check directory existence and read top-level files for each project
        const projects = await Promise.all(config.projects.map(async (project) => {
            const exists = await fs.pathExists(project.path);
            let files = [];
            let fileCount = 0;
            if (exists) {
                try {
                    const entries = await fs.readdir(project.path, { withFileTypes: true });
                    const sortedEntries = entries
                        .filter(e => !e.name.startsWith('.'))
                        .sort((a, b) => {
                        if (a.isDirectory() && !b.isDirectory())
                            return -1;
                        if (!a.isDirectory() && b.isDirectory())
                            return 1;
                        return a.name.localeCompare(b.name);
                    });
                    files = await Promise.all(sortedEntries.map(async (e) => {
                        const entry = {
                            name: e.name,
                            type: (e.isDirectory() ? 'directory' : 'file'),
                        };
                        // For directories, try to read SKILL.md frontmatter
                        if (e.isDirectory()) {
                            try {
                                const skillMdPath = path.join(project.path, e.name, 'SKILL.md');
                                if (await fs.pathExists(skillMdPath)) {
                                    const content = await fs.readFile(skillMdPath, 'utf-8');
                                    const meta = parseSkillFrontmatter(content);
                                    if (meta) {
                                        entry.skillName = meta.name;
                                        entry.skillDescription = meta.description;
                                    }
                                }
                            }
                            catch {
                                // Ignore read errors for individual SKILL.md files
                            }
                        }
                        return entry;
                    }));
                    fileCount = files.length;
                }
                catch {
                    // Failed to read directory, return empty files
                }
            }
            return { ...project, exists, files, fileCount };
        }));
        res.json({ projects });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get projects' });
    }
});
// POST /api/projects - Add project(s), supports single or batch
router.post('/', async (req, res) => {
    try {
        const body = req.body;
        // Normalize to array: support both single { path, name } and { projects: [...] }
        let items;
        if (Array.isArray(body.projects)) {
            items = body.projects;
        }
        else if (body.path) {
            items = [{ path: body.path, name: body.name }];
        }
        else {
            res.status(400).json({ error: 'Project path is required' });
            return;
        }
        const config = await getConfig();
        const added = [];
        const errors = [];
        for (const item of items) {
            if (!item.path) {
                errors.push({ path: '', error: 'Path is required' });
                continue;
            }
            // Expand ~ to home directory
            const expandedPath = expandHome(item.path.trim());
            // Check for duplicate
            if (config.projects.some(p => p.path === expandedPath)) {
                errors.push({ path: expandedPath, error: 'Project already exists' });
                continue;
            }
            // Remove from dismissed list if user manually re-adds
            if (config.dismissedPaths) {
                config.dismissedPaths = config.dismissedPaths.filter((p) => p !== expandedPath);
            }
            // Auto-create directory if it doesn't exist
            await fs.ensureDir(expandedPath);
            const projectName = item.name || path.basename(expandedPath);
            const newProject = {
                id: uuidv4(),
                name: projectName,
                path: expandedPath,
                createdAt: new Date().toISOString(),
                tools: [],
            };
            config.projects.push(newProject);
            added.push(newProject);
        }
        await saveConfig(config);
        // Always return consistent format with added array
        res.status(201).json({ added, errors });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to add project' });
    }
});
// POST /api/projects/check-paths - Check which paths exist on disk
router.post('/check-paths', async (req, res) => {
    try {
        const { paths } = req.body;
        if (!paths || !Array.isArray(paths)) {
            res.status(400).json({ error: 'paths array is required' });
            return;
        }
        const results = [];
        for (const p of paths) {
            const expanded = expandHome(p);
            results.push({ path: p, exists: await fs.pathExists(expanded) });
        }
        res.json({ results });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to check paths' });
    }
});
// POST /api/projects/auto-detect - Auto-detect projects based on configured tools
// Dynamically scans ~/.<configDir>/<skillsDir> for each tool in config
router.post('/auto-detect', async (_req, res) => {
    try {
        const config = await getConfig();
        const dismissedPaths = config.dismissedPaths || [];
        const added = [];
        // Build scan list from configured tools (both built-in and custom)
        const toolScanList = (config.tools || [])
            .filter(t => t.enabled !== false)
            .map(t => ({
            name: t.name,
            path: path.join(os.homedir(), t.configDir, t.skillsDir),
        }));
        for (const preset of toolScanList) {
            // Skip if already in project list
            if (config.projects.some(p => p.path === preset.path)) {
                continue;
            }
            // Skip if user previously dismissed this path
            if (dismissedPaths.includes(preset.path)) {
                continue;
            }
            // Only add if directory actually exists on disk
            if (await fs.pathExists(preset.path)) {
                const newProject = {
                    id: uuidv4(),
                    name: preset.name,
                    path: preset.path,
                    createdAt: new Date().toISOString(),
                    tools: [],
                };
                config.projects.push(newProject);
                added.push(newProject);
            }
        }
        if (added.length > 0) {
            await saveConfig(config);
        }
        res.json({ added, total: config.projects.length });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to auto-detect projects' });
    }
});
// DELETE /api/projects/:id - Remove project from list
router.delete('/:id', async (req, res) => {
    try {
        const config = await getConfig();
        const index = config.projects.findIndex(p => p.id === req.params.id);
        if (index === -1) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }
        // Record the dismissed path so auto-detect won't re-add it
        const removedPath = config.projects[index].path;
        if (!config.dismissedPaths) {
            config.dismissedPaths = [];
        }
        if (!config.dismissedPaths.includes(removedPath)) {
            config.dismissedPaths.push(removedPath);
        }
        config.projects.splice(index, 1);
        await saveConfig(config);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete project' });
    }
});
// GET /api/projects/browse - Browse project directory file tree
router.get('/browse', async (req, res) => {
    try {
        const dirPath = req.query.path;
        if (!dirPath) {
            res.status(400).json({ error: 'Directory path is required' });
            return;
        }
        const expandedPath = expandHome(dirPath);
        if (!await fs.pathExists(expandedPath)) {
            res.status(404).json({ error: 'Directory not found' });
            return;
        }
        const tree = await buildFileTree(expandedPath);
        res.json({ tree });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to browse directory' });
    }
});
export default router;
