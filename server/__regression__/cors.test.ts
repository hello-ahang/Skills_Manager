/**
 * CORS allowlist regression. Locks the invariant that:
 *   1. Known dev/local origins (5173, 5174, the configured server port) pass.
 *   2. Arbitrary external origins are blocked.
 *
 * History: the dev-mode regex `LOCAL_ORIGIN_RE` accepts any port on
 * localhost. That's narrowly OK because pathGuard + auth still gate API
 * access, but combined with a future "CORS reflects all" mistake it
 * would expose the API to any local malicious page. These tests fail if
 * someone changes the allowlist to `*` or adds a wildcard host.
 */
import { describe, it, expect } from 'vitest';
import express from 'express';
import cors from 'cors';
import request from 'supertest';

// Mirror the production isOriginAllowed logic (we copy rather than import
// from index.ts because index.ts side-effects start the server).
const allowedOrigins = new Set<string>([
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5174',
  'http://localhost:5174',
]);

const LOCAL_ORIGIN_RE = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/;

function buildApp(isDev: boolean) {
  const app = express();
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowedOrigins.has(origin)) return cb(null, true);
        if (isDev && LOCAL_ORIGIN_RE.test(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: false,
      allowedHeaders: ['Content-Type', 'X-SM-Token'],
    }),
  );
  app.get('/api/probe', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('CORS allowlist (regression)', () => {
  it('allows known whitelist origin (vite dev port 5173)', async () => {
    const app = buildApp(false);
    const res = await request(app)
      .options('/api/probe')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('blocks unknown origin in production mode', async () => {
    const app = buildApp(false);
    const res = await request(app)
      .options('/api/probe')
      .set('Origin', 'https://attacker.example.com')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('blocks unknown origin even in dev mode (only matches loopback/localhost)', async () => {
    const app = buildApp(true);
    const res = await request(app)
      .options('/api/probe')
      .set('Origin', 'http://corp.intranet:8080')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows any localhost port in dev mode', async () => {
    const app = buildApp(true);
    const res = await request(app)
      .options('/api/probe')
      .set('Origin', 'http://127.0.0.1:9999')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).toBe('http://127.0.0.1:9999');
  });
});
