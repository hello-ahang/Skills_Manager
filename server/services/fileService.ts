import fs from 'fs-extra';
import path from 'path';
import type { FileTreeNode } from '../../src/types/index.js';

// Parse SKILL.md frontmatter to extract description and check validity
interface SkillMeta {
  description?: string;
  isValidSkill: boolean;
}

async function parseSkillMeta(dirPath: string): Promise<SkillMeta> {
  const skillMdPath = path.join(dirPath, 'SKILL.md');
  if (!await fs.pathExists(skillMdPath)) return { isValidSkill: false };

  try {
    const content = await fs.readFile(skillMdPath, 'utf-8');
    // Match YAML frontmatter between --- delimiters
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      // No frontmatter, but SKILL.md exists — check for name/description in content header
      const hasName = /^#+\s*.+/m.test(content) || /^name:\s*.+/m.test(content);
      const hasDesc = /^description:\s*.+/m.test(content);
      return { isValidSkill: hasName && hasDesc };
    }

    const frontmatter = frontmatterMatch[1];
    // Extract name and description fields
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    const descMatch = frontmatter.match(/^description:\s*(.+)$/m);

    const isValid = !!(nameMatch && descMatch);
    return {
      description: descMatch ? descMatch[1].trim() : undefined,
      isValidSkill: isValid,
    };
  } catch {
    return { isValidSkill: false };
  }
}

export async function buildFileTree(dirPath: string): Promise<FileTreeNode[]> {
  if (!await fs.pathExists(dirPath)) {
    return [];
  }

  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const nodes: FileTreeNode[] = [];

  // Sort: directories first, then files, alphabetically
  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of sorted) {
    // Skip hidden files and directories
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      const children = await buildFileTree(fullPath);
      const skillMeta = await parseSkillMeta(fullPath);
      const node: FileTreeNode = {
        name: entry.name,
        path: fullPath,
        type: 'directory',
        children,
      };
      if (skillMeta.description) {
        node.description = skillMeta.description;
      }
      if (skillMeta.isValidSkill) {
        node.isValidSkill = true;
      }
      nodes.push(node);
    } else {
      nodes.push({
        name: entry.name,
        path: fullPath,
        type: 'file',
      });
    }
  }

  return nodes;
}

export async function readFileContent(filePath: string): Promise<{ content: string; updatedAt: string }> {
  if (!await fs.pathExists(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = await fs.readFile(filePath, 'utf-8');
  const stat = await fs.stat(filePath);

  return {
    content,
    updatedAt: stat.mtime.toISOString(),
  };
}

export async function writeFileContent(filePath: string, content: string): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

export async function createNewFile(filePath: string, content: string = ''): Promise<void> {
  if (await fs.pathExists(filePath)) {
    throw new Error(`File already exists: ${filePath}`);
  }
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

export async function deleteFile(filePath: string): Promise<void> {
  if (!await fs.pathExists(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  await fs.remove(filePath);
}

export async function searchFiles(
  dirPath: string,
  query: string
): Promise<{ path: string; matches: { line: number; text: string }[] }[]> {
  const results: { path: string; matches: { line: number; text: string }[] }[] = [];

  if (!await fs.pathExists(dirPath)) {
    return results;
  }

  const queryLower = query.toLowerCase();

  async function searchDir(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await searchDir(fullPath);
      } else {
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          const lines = content.split('\n');
          const matches: { line: number; text: string }[] = [];

          lines.forEach((line, index) => {
            if (line.toLowerCase().includes(queryLower)) {
              matches.push({
                line: index + 1,
                text: line.trim(),
              });
            }
          });

          if (matches.length > 0) {
            results.push({ path: fullPath, matches });
          }
        } catch {
          // Skip binary or unreadable files
        }
      }
    }
  }

  await searchDir(dirPath);
  return results;
}
