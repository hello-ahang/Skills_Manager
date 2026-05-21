import type { Request, Response, NextFunction } from 'express';
import os from 'os';
import path from 'path';
import { getConfig } from '../services/configService.js';
import { validatePathInRoots } from '../utils/validation.js';

const HOME = os.homedir();
const USER_DATA_ROOT = path.join(HOME, '.skills-manager');

export async function getDefaultAllowedRoots(): Promise<string[]> {
  const roots = new Set<string>();
  roots.add(USER_DATA_ROOT);

  try {
    const config = await getConfig();
    if (config.sourceDir) roots.add(config.sourceDir);
    if (Array.isArray(config.sourceDirs)) {
      for (const sd of config.sourceDirs) {
        if (sd?.path) roots.add(sd.path);
      }
    }
    if (Array.isArray(config.projects)) {
      for (const p of config.projects) {
        if (p?.path) roots.add(p.path);
      }
    }
  } catch {
    // configService initialization issues should not break path guard;
    // fall back to USER_DATA_ROOT only.
  }

  return Array.from(roots).filter(Boolean);
}

const PATH_FIELDS = [
  'path',
  'oldPath',
  'newPath',
  'targetPath',
  'sourcePath',
  'skillPath',
  'skillPathA',
  'skillPathB',
  'dirPath',
  'filePath',
];

function extractCandidatePaths(req: Request): string[] {
  const out: string[] = [];
  const body = (req.body || {}) as Record<string, unknown>;
  for (const field of PATH_FIELDS) {
    const v = body[field];
    if (typeof v === 'string' && v.length > 0) out.push(v);
  }
  for (const field of PATH_FIELDS) {
    const v = req.query?.[field];
    if (typeof v === 'string' && v.length > 0) out.push(v);
  }
  if (Array.isArray(body.paths)) {
    for (const p of body.paths) {
      if (typeof p === 'string' && p.length > 0) out.push(p);
    }
  }
  if (Array.isArray(body.skillPaths)) {
    for (const p of body.skillPaths) {
      if (typeof p === 'string' && p.length > 0) out.push(p);
    }
  }
  return out;
}

export function pathGuard(
  getRoots: (req: Request) => Promise<string[]> = getDefaultAllowedRoots
) {
  return async function (req: Request, res: Response, next: NextFunction): Promise<void> {
    const candidates = extractCandidatePaths(req);
    if (candidates.length === 0) {
      next();
      return;
    }

    let roots: string[] = [];
    try {
      roots = await getRoots(req);
    } catch (err) {
      res.status(500).json({ error: 'pathGuard: failed to resolve allowed roots' });
      return;
    }

    if (roots.length === 0) {
      res.status(403).json({ error: 'No allowed source directories configured' });
      return;
    }

    for (const candidate of candidates) {
      if (!validatePathInRoots(candidate, roots)) {
        res.status(403).json({
          error: `Path is outside the allowed directories: ${candidate}`,
        });
        return;
      }
    }

    next();
  };
}
