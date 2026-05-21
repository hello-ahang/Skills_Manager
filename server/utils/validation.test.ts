import { describe, it, expect } from 'vitest';
import path from 'path';
import os from 'os';
import {
  isPathInside,
  validatePathInRoots,
  validateFileName,
  validatePath,
  isMarkdownFile,
  validateToolType,
} from './validation.js';

describe('isPathInside', () => {
  const root = path.join(os.tmpdir(), 'sm-root');

  it('returns true for direct children', () => {
    expect(isPathInside(path.join(root, 'a.md'), root)).toBe(true);
  });

  it('returns true for nested children', () => {
    expect(isPathInside(path.join(root, 'a', 'b', 'c.md'), root)).toBe(true);
  });

  it('returns true for the root itself', () => {
    expect(isPathInside(root, root)).toBe(true);
  });

  it('returns false for sibling directories', () => {
    expect(isPathInside(path.join(os.tmpdir(), 'sibling', 'x.md'), root)).toBe(false);
  });

  it('rejects path traversal with ..', () => {
    expect(isPathInside(path.join(root, '..', 'etc', 'passwd'), root)).toBe(false);
  });

  it('rejects path traversal with deep ..', () => {
    expect(isPathInside(path.join(root, 'a', '..', '..', 'etc'), root)).toBe(false);
  });

  it('rejects absolute paths outside root', () => {
    expect(isPathInside('/etc/passwd', root)).toBe(false);
  });

  it('returns false for empty inputs', () => {
    expect(isPathInside('', root)).toBe(false);
    expect(isPathInside(root, '')).toBe(false);
  });
});

describe('validatePathInRoots', () => {
  const root1 = path.join(os.tmpdir(), 'sm-root1');
  const root2 = path.join(os.tmpdir(), 'sm-root2');

  it('passes when path is in any root', () => {
    expect(validatePathInRoots(path.join(root1, 'a.md'), [root1, root2])).toBe(true);
    expect(validatePathInRoots(path.join(root2, 'b.md'), [root1, root2])).toBe(true);
  });

  it('fails when path is in no root', () => {
    expect(validatePathInRoots('/etc/passwd', [root1, root2])).toBe(false);
  });

  it('fails for empty roots', () => {
    expect(validatePathInRoots(path.join(root1, 'a.md'), [])).toBe(false);
  });

  it('rejects traversal attempts', () => {
    expect(validatePathInRoots(`${root1}/../../../etc/passwd`, [root1])).toBe(false);
  });
});

describe('validateFileName', () => {
  it('accepts standard names', () => {
    expect(validateFileName('skill.md')).toBe(true);
    expect(validateFileName('my-skill.js')).toBe(true);
    expect(validateFileName('_underscore.txt')).toBe(true);
  });

  it('rejects names with path separators', () => {
    expect(validateFileName('a/b.md')).toBe(false);
    expect(validateFileName('a\\b.md')).toBe(false);
  });

  it('rejects . and ..', () => {
    expect(validateFileName('.')).toBe(false);
    expect(validateFileName('..')).toBe(false);
  });

  it('rejects names with control or special characters', () => {
    expect(validateFileName('a:b')).toBe(false);
    expect(validateFileName('a*b')).toBe(false);
    expect(validateFileName('a?b')).toBe(false);
    expect(validateFileName('a<b')).toBe(false);
    expect(validateFileName('a\x01b')).toBe(false);
  });

  it('rejects empty', () => {
    expect(validateFileName('')).toBe(false);
  });
});

describe('validatePath', () => {
  it('rejects null bytes', () => {
    expect(validatePath('foo\x00.md')).toBe(false);
  });

  it('accepts plain absolute path', () => {
    expect(validatePath('/tmp/foo.md')).toBe(true);
  });

  it('rejects empty', () => {
    expect(validatePath('')).toBe(false);
  });
});

describe('isMarkdownFile', () => {
  it('detects .md', () => {
    expect(isMarkdownFile('a.md')).toBe(true);
    expect(isMarkdownFile('a.MD')).toBe(true);
  });

  it('rejects non-markdown', () => {
    expect(isMarkdownFile('a.txt')).toBe(false);
  });
});

describe('validateToolType', () => {
  it('accepts known types', () => {
    expect(validateToolType('claude')).toBe(true);
    expect(validateToolType('cursor')).toBe(true);
  });

  it('rejects unknown types', () => {
    expect(validateToolType('unknown')).toBe(false);
  });
});
