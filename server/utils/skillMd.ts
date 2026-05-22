/**
 * Canonical SKILL.md parser shared between rubric / card / future services.
 *
 * Returns the raw text, the frontmatter slice (if any), the body (raw minus
 * frontmatter), and the two fields every consumer ends up parsing — `name`
 * and `description`. `related` is optional because rubric checks don't need
 * it but the card builder does.
 */
import fs from 'fs-extra';
import path from 'path';
import { parseYamlField, parseYamlList } from './yamlUtils.js';

export interface ParsedSkillMd {
  raw: string;
  frontmatter: string | null;
  body: string;
  name?: string;
  description?: string;
  related: string[];
}

export interface ParseSkillMdOptions {
  /** If true, the read & parse run even when SKILL.md is absent (returns null) instead of throwing. Default true. */
  silentOnMissing?: boolean;
}

export async function parseSkillMd(
  skillDir: string,
  opts: ParseSkillMdOptions = {},
): Promise<ParsedSkillMd | null> {
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  let raw: string;
  try {
    raw = await fs.readFile(skillMdPath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT' && opts.silentOnMissing !== false) {
      return null;
    }
    throw err;
  }

  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    return { raw, frontmatter: null, body: raw, related: [] };
  }

  const frontmatter = fmMatch[1];
  const body = raw.slice(fmMatch[0].length);
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  const name = nameMatch ? nameMatch[1].trim().replace(/^['"]|['"]$/g, '') : undefined;
  const description = parseYamlField(frontmatter, 'description') || undefined;
  const related = parseYamlList(frontmatter, 'related');

  return { raw, frontmatter, body, name, description, related };
}
