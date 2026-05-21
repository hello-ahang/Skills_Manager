import type { Request, Response, NextFunction } from 'express';

/**
 * Minimal in-memory rate limiter — sliding-ish fixed-window, keyed by IP.
 *
 * Why hand-roll instead of pulling express-rate-limit:
 *   - Server is single-process (no shared state between Node workers),
 *     so a Map keyed by IP is sufficient.
 *   - Avoids adding a new npm dep + lockfile churn.
 *
 * This is DoS-grade defense, not a production-grade abuse control. It will
 * not survive a process restart (counts reset) and is not suitable for
 * distributed deployments. For Skills_Manager's local-tool threat model
 * that's acceptable.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Window length in ms. Default 60_000 (1 minute). */
  windowMs?: number;
  /** Max requests per window per IP. */
  max: number;
  /** Optional message override. */
  message?: string;
}

function clientKey(req: Request): string {
  // Prefer X-Forwarded-For first hop when present (we may be behind a local
  // dev proxy), else fall back to remoteAddress. We deliberately do NOT use
  // a fully-qualified IP; for local-tool use a coarse key is enough.
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0]!.trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function rateLimit(opts: RateLimitOptions) {
  const windowMs = opts.windowMs ?? 60_000;
  const buckets = new Map<string, Bucket>();
  const message = opts.message ?? 'Too many requests, slow down.';

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const key = clientKey(req);
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (existing.count >= opts.max) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil((existing.resetAt - now) / 1000)).toString());
      res.status(429).json({ error: message });
      return;
    }

    existing.count += 1;
    next();
  };
}
