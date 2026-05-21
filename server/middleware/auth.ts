import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const SECURITY_PATH = path.join(os.homedir(), '.skills-manager', 'security.json');
const SECURITY_DIR = path.dirname(SECURITY_PATH);

function isLoopbackHost(host: string): boolean {
  return host === '127.0.0.1' || host === '::1' || host === 'localhost';
}

function isAuthDisabled(): boolean {
  // Auth bypass requires BOTH explicit opt-in (SM_AUTH_DISABLE=1) AND a
  // loopback-only listen host. The previous "dev mode disables auth" rule
  // exposed unauthenticated APIs whenever SM_HOST was overridden to 0.0.0.0.
  if (process.env.SM_AUTH_DISABLE !== '1') return false;
  const host = process.env.SM_HOST || '127.0.0.1';
  return isLoopbackHost(host);
}

interface SecurityConfig {
  token: string;
  createdAt: string;
}

let cachedToken: string | null = null;

export async function ensureToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  // Tighten directory perms to 0700 so the parent dir doesn't world-read
  // (security.json itself is chmod 0600, but a 0755 parent dir leaks listings).
  await fs.ensureDir(SECURITY_DIR);
  await fs.chmod(SECURITY_DIR, 0o700).catch(() => { /* best effort on Windows */ });

  if (await fs.pathExists(SECURITY_PATH)) {
    try {
      const data = (await fs.readJson(SECURITY_PATH)) as SecurityConfig;
      if (data.token && typeof data.token === 'string' && data.token.length >= 16) {
        cachedToken = data.token;
        return cachedToken;
      }
    } catch {
      // Fall through to regenerate
    }
  }

  const token = uuidv4().replace(/-/g, '');
  const data: SecurityConfig = { token, createdAt: new Date().toISOString() };
  await fs.writeJson(SECURITY_PATH, data, { spaces: 2 });
  await fs.chmod(SECURITY_PATH, 0o600).catch(() => { /* best effort on Windows */ });
  cachedToken = token;
  return token;
}

export function getCachedToken(): string | null {
  return cachedToken;
}

const EXEMPT_PREFIXES = ['/api/health'];

function isExempt(reqPath: string): boolean {
  if (!reqPath.startsWith('/api/')) return true;
  return EXEMPT_PREFIXES.some(p => reqPath === p || reqPath.startsWith(`${p}/`));
}

/**
 * Constant-time string comparison via crypto.timingSafeEqual. Inputs are
 * length-padded with NUL bytes so length-mismatch doesn't short-circuit
 * (which would leak the expected length via timing side channel).
 *
 * Returns false if `a` and `b` differ in length, but only after running
 * the full comparison so the early exit isn't observable from outside.
 */
function safeStringEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  const aBuf = Buffer.alloc(len);
  const bBuf = Buffer.alloc(len);
  aBuf.write(a);
  bBuf.write(b);
  const equal = crypto.timingSafeEqual(aBuf, bBuf);
  return equal && a.length === b.length;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (isExempt(req.path)) {
    next();
    return;
  }

  // Auth bypass requires explicit SM_AUTH_DISABLE=1 AND loopback host.
  if (isAuthDisabled()) {
    next();
    return;
  }

  const expected = cachedToken;
  if (!expected) {
    res.status(503).json({ error: 'Server not ready: token not initialized' });
    return;
  }

  // Token MUST come via header. Query strings end up in access logs, browser
  // history, and Referer headers — never read tokens from there.
  const headerToken = (req.headers['x-sm-token'] as string | undefined) || '';
  const authHeader = (req.headers['authorization'] as string | undefined) || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const provided = headerToken || bearerToken;

  if (!provided || !safeStringEqual(provided, expected)) {
    res.status(401).json({ error: 'Unauthorized: missing or invalid token' });
    return;
  }

  next();
}
