import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware, ensureToken } from './auth.js';

// Tests must run with auth enabled (production-like), regardless of host env
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_AUTH_DISABLE = process.env.SM_AUTH_DISABLE;

interface MockResponse {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  statusCode?: number;
  body?: unknown;
}

function makeReq(reqPath: string, headers: Record<string, string> = {}, query: Record<string, string> = {}): Request {
  return {
    path: reqPath,
    headers,
    query,
  } as unknown as Request;
}

function makeRes(): MockResponse & Partial<Response> {
  const res: MockResponse = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json.mockImplementation((body: unknown) => {
    res.body = body;
    return res;
  });
  return res as MockResponse & Partial<Response>;
}

describe('authMiddleware', () => {
  let token: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SM_AUTH_DISABLE;
    token = await ensureToken();
    expect(token.length).toBeGreaterThanOrEqual(16);
  });

  afterAll(() => {
    if (ORIGINAL_NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    if (ORIGINAL_AUTH_DISABLE === undefined) delete process.env.SM_AUTH_DISABLE;
    else process.env.SM_AUTH_DISABLE = ORIGINAL_AUTH_DISABLE;
  });

  it('passes through /api/health without token', () => {
    const next = vi.fn() as NextFunction;
    const req = makeReq('/api/health');
    const res = makeRes() as Response;
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('passes through non-/api paths without token', () => {
    const next = vi.fn() as NextFunction;
    const req = makeReq('/index.html');
    const res = makeRes() as Response;
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects /api/skills without token', () => {
    const next = vi.fn() as NextFunction;
    const req = makeReq('/api/skills');
    const res = makeRes() as Response;
    authMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect((res as unknown as MockResponse).statusCode).toBe(401);
  });

  it('rejects with wrong token', () => {
    const next = vi.fn() as NextFunction;
    const req = makeReq('/api/skills', { 'x-sm-token': 'wrong-token-123' });
    const res = makeRes() as Response;
    authMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect((res as unknown as MockResponse).statusCode).toBe(401);
  });

  it('accepts correct token via X-SM-Token header', () => {
    const next = vi.fn() as NextFunction;
    const req = makeReq('/api/skills', { 'x-sm-token': token });
    const res = makeRes() as Response;
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('accepts correct token via Authorization Bearer header', () => {
    const next = vi.fn() as NextFunction;
    const req = makeReq('/api/skills', { authorization: `Bearer ${token}` });
    const res = makeRes() as Response;
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects token passed via query string (regression — query tokens leak to logs/Referer)', () => {
    const next = vi.fn() as NextFunction;
    const req = makeReq('/api/skills', {}, { token });
    const res = makeRes() as Response;
    authMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect((res as unknown as MockResponse).statusCode).toBe(401);
  });

  it('rejects token of different length', () => {
    const next = vi.fn() as NextFunction;
    const req = makeReq('/api/skills', { 'x-sm-token': token + 'x' });
    const res = makeRes() as Response;
    authMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect((res as unknown as MockResponse).statusCode).toBe(401);
  });
});

describe('ensureToken', () => {
  it('is idempotent across calls', async () => {
    const a = await ensureToken();
    const b = await ensureToken();
    expect(a).toBe(b);
  });

  it('writes security.json with chmod 0600 (regression: token perms)', async () => {
    // chmod is best-effort on Windows; skip there. Linux/macOS must enforce.
    if (process.platform === 'win32') return;
    await ensureToken();
    const fs = await import('fs-extra');
    const os = await import('os');
    const path = await import('path');
    const stat = await fs.stat(path.join(os.homedir(), '.skills-manager', 'security.json'));
    // Lower 9 bits = perms; mask 0o777. Owner-only read/write = 0o600.
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it('writes ~/.skills-manager directory with chmod 0700 (regression: parent dir perms)', async () => {
    if (process.platform === 'win32') return;
    await ensureToken();
    const fs = await import('fs-extra');
    const os = await import('os');
    const path = await import('path');
    const stat = await fs.stat(path.join(os.homedir(), '.skills-manager'));
    expect(stat.mode & 0o777).toBe(0o700);
  });
});
