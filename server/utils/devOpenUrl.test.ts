import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getDevOpenUrl } from './devOpenUrl';

describe('getDevOpenUrl', () => {
  let tmpFile: string;

  beforeEach(() => {
    tmpFile = path.join(
      os.tmpdir(),
      `sm-dev-open-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    );
  });

  afterEach(() => {
    try { fs.unlinkSync(tmpFile); } catch { /* file may not exist */ }
  });

  it('returns ?token URL when security.json has a valid 32-char token', () => {
    const token = 'a'.repeat(32);
    fs.writeFileSync(tmpFile, JSON.stringify({ token, createdAt: '2026-05-22T00:00:00Z' }));
    expect(getDevOpenUrl(tmpFile)).toBe(`/?token=${token}`);
  });

  it('returns true when file does not exist', () => {
    const ghostFile = path.join(os.tmpdir(), `sm-dev-open-ghost-${Date.now()}.json`);
    expect(getDevOpenUrl(ghostFile)).toBe(true);
  });

  it('returns true when JSON is malformed', () => {
    fs.writeFileSync(tmpFile, '{not valid json');
    expect(getDevOpenUrl(tmpFile)).toBe(true);
  });

  it('returns true when token field is missing', () => {
    fs.writeFileSync(tmpFile, JSON.stringify({ createdAt: 'now' }));
    expect(getDevOpenUrl(tmpFile)).toBe(true);
  });

  it('returns true when token is too short to be plausible (< 16 chars)', () => {
    fs.writeFileSync(tmpFile, JSON.stringify({ token: 'shorty', createdAt: 'now' }));
    expect(getDevOpenUrl(tmpFile)).toBe(true);
  });

  it('returns true when token is non-string', () => {
    fs.writeFileSync(tmpFile, JSON.stringify({ token: 12345, createdAt: 'now' }));
    expect(getDevOpenUrl(tmpFile)).toBe(true);
  });

  it('returns true when JSON root is not an object', () => {
    fs.writeFileSync(tmpFile, JSON.stringify('a string instead of an object'));
    expect(getDevOpenUrl(tmpFile)).toBe(true);
  });

  it('URL-encodes special chars defensively (real tokens are hex but security.json is user-editable)', () => {
    const token = 'token+with/special&chars=' + 'x'.repeat(20);
    fs.writeFileSync(tmpFile, JSON.stringify({ token, createdAt: 'now' }));
    const result = getDevOpenUrl(tmpFile);
    expect(result).toBe(`/?token=${encodeURIComponent(token)}`);
    // sanity: raw special chars must not survive into the URL
    expect(result).not.toContain('+');
    expect(result).not.toContain('&');
  });

  it('accepts the exact 16-char token boundary', () => {
    const token = 'a'.repeat(16);
    fs.writeFileSync(tmpFile, JSON.stringify({ token, createdAt: 'now' }));
    expect(getDevOpenUrl(tmpFile)).toBe(`/?token=${token}`);
  });
});
