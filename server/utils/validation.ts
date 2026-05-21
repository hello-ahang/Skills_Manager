import path from 'path';
import fs from 'fs-extra';

export function isPathInside(inputPath: string, root: string): boolean {
  if (!inputPath || !root || typeof inputPath !== 'string' || typeof root !== 'string') {
    return false;
  }
  const resolvedRoot = path.resolve(root);
  const resolvedInput = path.resolve(inputPath);
  if (resolvedInput === resolvedRoot) return true;
  const rel = path.relative(resolvedRoot, resolvedInput);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return false;
  return true;
}

export function validatePathInRoots(inputPath: string, roots: string[]): boolean {
  if (!inputPath || typeof inputPath !== 'string') return false;
  if (!Array.isArray(roots) || roots.length === 0) return false;
  return roots.some(root => root && isPathInside(inputPath, root));
}

export function validatePath(inputPath: string): boolean {
  if (!inputPath || typeof inputPath !== 'string') return false;
  const resolved = path.resolve(inputPath);
  if (resolved.includes('\0')) return false;
  return true;
}

export async function validatePathExists(inputPath: string): Promise<boolean> {
  if (!validatePath(inputPath)) return false;
  return fs.pathExists(inputPath);
}

// Windows reserved device names (case-insensitive, with or without extension).
// On Windows these resolve to console devices and break filesystem ops.
const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

export function validateFileName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  if (name === '.' || name === '..') return false;
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (invalidChars.test(name)) return false;
  if (WINDOWS_RESERVED_NAMES.test(name)) return false;
  return true;
}

/**
 * @deprecated Do not use — `replace(/\.\./g, '')` is a known-broken sanitizer
 * (e.g. `....//` collapses to `..//` and re-introduces traversal). Callers
 * MUST use `validatePathInRoots()` instead and reject inputs that fall
 * outside the allow-listed roots. Kept exported only to avoid breaking the
 * single test/import consumer; remove once that's migrated.
 */
export function sanitizePath(_inputPath: string): string {
  throw new Error(
    'sanitizePath is deprecated and unsafe. Use validatePathInRoots(input, allowedRoots) and reject the request when it returns false.',
  );
}

export function isMarkdownFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ['.md', '.markdown', '.mdown', '.mkd'].includes(ext);
}

export function validateToolType(type: string): boolean {
  const validTypes = ['claude', 'cursor', 'codebuddy', 'copilot', 'custom'];
  return validTypes.includes(type);
}
