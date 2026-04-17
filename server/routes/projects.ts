import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { getConfig, saveConfig } from '../services/configService.js';
import { buildFileTree } from '../services/fileService.js';

const router = Router();

// Expand ~ to home directory
function expandHome(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

/**
 * Parse YAML frontmatter from a SKILL.md file content.
 * Returns { name, description } or null if no valid frontmatter found.
 */
function parseSkillFrontmatter(content: string): { name?: string; description?: string } | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return null;

  const frontmatter = match[1];
  const result: { name?: string; description?: string } = {};

  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  if (nameMatch) result.name = nameMatch[1].trim().replace(/^['"]|['"]$/g, '');

  const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
  if (descMatch) result.description = descMatch[1].trim().replace(/^['"]|['"]$/g, '');

  return (result.name || result.description) ? result : null;
}

// GET /api/projects - Get all projects with their top-level files
router.get('/', async (_req: Request, res: Response) => {
  try {
    const config = await getConfig();
    // Check directory existence and read top-level files for each project
    const projects = await Promise.all(
      config.projects.map(async (project) => {
        const exists = await fs.pathExists(project.path);
        let files: { name: string; type: 'file' | 'directory'; skillName?: string; skillDescription?: string }[] = [];
        let fileCount = 0;

        if (exists) {
          try {
            const entries = await fs.readdir(project.path, { withFileTypes: true });
            const sortedEntries = entries
              .filter(e => !e.name.startsWith('.'))
              .sort((a, b) => {
                if (a.isDirectory() && !b.isDirectory()) return -1;
                if (!a.isDirectory() && b.isDirectory()) return 1;
                return a.name.localeCompare(b.name);
              });

            files = await Promise.all(
              sortedEntries.map(async (e) => {
                const entry: { name: string; type: 'file' | 'directory'; skillName?: string; skillDescription?: string } = {
                  name: e.name,
                  type: (e.isDirectory() ? 'directory' : 'file') as 'file' | 'directory',
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
                  } catch {
                    // Ignore read errors for individual SKILL.md files
                  }
                }

                return entry;
              })
            );
            fileCount = files.length;
          } catch {
            // Failed to read directory, return empty files
          }
        }

        return { ...project, exists, files, fileCount };
      })
    );
    res.json({ projects });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get projects' });
  }
});

// POST /api/projects - Add project(s), supports single or batch
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body;

    // Normalize to array: support both single { path, name } and { projects: [...] }
    let items: { path: string; name?: string }[];
    if (Array.isArray(body.projects)) {
      items = body.projects;
    } else if (body.path) {
      items = [{ path: body.path, name: body.name }];
    } else {
      res.status(400).json({ error: 'Project path is required' });
      return;
    }

    const config = await getConfig();
    const added: any[] = [];
    const errors: { path: string; error: string }[] = [];

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
      if ((config as any).dismissedPaths) {
        (config as any).dismissedPaths = (config as any).dismissedPaths.filter((p: string) => p !== expandedPath);
      }

      // Auto-create directory if it doesn't exist
      await fs.ensureDir(expandedPath);

      const projectName = item.name || path.basename(expandedPath);
      const newProject = {
        id: uuidv4(),
        name: projectName,
        path: expandedPath,
        createdAt: new Date().toISOString(),
        tools: [] as any[],
      };

      config.projects.push(newProject);
      added.push(newProject);
    }

    await saveConfig(config);

    if (added.length === 1 && errors.length === 0) {
      // Single add: return the project directly for backward compatibility
      res.status(201).json(added[0]);
    } else {
      res.status(201).json({ added, errors });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to add project' });
  }
});

// Preset projects for auto-detection
const PRESET_PROJECTS = [
  { name: 'Qoder', path: '~/.qoder/skills' },
  { name: 'Cursor', path: '~/.cursor/skills-cursor' },
  { name: 'Copilot', path: '~/.copilot/skills' },
  { name: 'Codex', path: '~/.codex/skills' },
  { name: 'Claude', path: '~/.claude/skills' },
  { name: 'OpenClaw', path: '~/.openclaw/skills' },
  { name: 'QoderWork', path: '~/.qoderwork/skills' },
];

// POST /api/projects/auto-detect - Auto-detect preset projects
router.post('/auto-detect', async (_req: Request, res: Response) => {
  try {
    const config = await getConfig();
    const dismissedPaths: string[] = (config as any).dismissedPaths || [];
    const added: any[] = [];

    for (const preset of PRESET_PROJECTS) {
      const expandedPath = expandHome(preset.path);

      // Skip if already in project list
      if (config.projects.some(p => p.path === expandedPath)) {
        continue;
      }

      // Skip if user previously dismissed this path
      if (dismissedPaths.includes(expandedPath)) {
        continue;
      }

      // Only add if directory actually exists on disk
      if (await fs.pathExists(expandedPath)) {
        const newProject = {
          id: uuidv4(),
          name: preset.name,
          path: expandedPath,
          createdAt: new Date().toISOString(),
          tools: [] as any[],
        };
        config.projects.push(newProject);
        added.push(newProject);
      }
    }

    if (added.length > 0) {
      await saveConfig(config);
    }

    res.json({ added, total: config.projects.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to auto-detect projects' });
  }
});

// DELETE /api/projects/:id - Remove project from list
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const config = await getConfig();
    const index = config.projects.findIndex(p => p.id === req.params.id);

    if (index === -1) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Record the dismissed path so auto-detect won't re-add it
    const removedPath = config.projects[index].path;
    if (!(config as any).dismissedPaths) {
      (config as any).dismissedPaths = [];
    }
    if (!(config as any).dismissedPaths.includes(removedPath)) {
      (config as any).dismissedPaths.push(removedPath);
    }

    config.projects.splice(index, 1);
    await saveConfig(config);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// GET /api/projects/browse - Browse project directory file tree
router.get('/browse', async (req: Request, res: Response) => {
  try {
    const dirPath = req.query.path as string;
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to browse directory' });
  }
});

export default router;
