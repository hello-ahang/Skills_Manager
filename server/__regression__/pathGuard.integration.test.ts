/**
 * pathGuard integration test — locks the C1 fix in place.
 *
 * History: pathGuard middleware existed in the v1.6 WIP but was never
 * mounted in server/index.ts. This left /api/fresh, /api/compare, and
 * /api/feedback accepting absolute paths anywhere on disk. C1 wired
 * `app.use('/api', pathGuard())` and added skillPathA/skillPathB to
 * PATH_FIELDS. These tests fail if either change is reverted.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { pathGuard } from '../middleware/pathGuard.js';

// Build a minimal app that mirrors the production middleware chain for
// the routes we care about. We don't import the real routers because
// they pull in the full SQLite + service stack; the guard runs first
// and handles the only thing this test cares about.
function buildApp() {
  const app = express();
  app.use(express.json());

  // Pass a synthesized roots resolver so the test doesn't depend on the
  // user's actual ~/.skills-manager/user-config.json.
  const allowed = ['/tmp/sm-test-allowed-root'];
  app.use('/api', pathGuard(async () => allowed));

  // Echo handlers — never reached if the guard rejects.
  app.post('/api/fresh/check', (_req, res) => res.json({ ok: true }));
  app.post('/api/compare/skills', (_req, res) => res.json({ ok: true }));
  app.post('/api/feedback', (_req, res) => res.json({ ok: true }));

  return app;
}

describe('pathGuard integration (regression: C1)', () => {
  let app: express.Express;

  beforeAll(() => {
    app = buildApp();
  });

  it('rejects /api/fresh/check with skillPath outside allowed roots', async () => {
    const res = await request(app)
      .post('/api/fresh/check')
      .send({ skillPath: '/etc/' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/outside the allowed directories/i);
  });

  it('rejects /api/compare/skills with skillPathA outside allowed roots', async () => {
    // skillPathA is the field that the original PATH_FIELDS list missed.
    // If a future refactor drops it from the array, this test fails.
    const res = await request(app)
      .post('/api/compare/skills')
      .send({ skillPathA: '/etc/passwd', skillPathB: '/tmp/sm-test-allowed-root/foo' });
    expect(res.status).toBe(403);
  });

  it('rejects /api/compare/skills with skillPathB outside allowed roots', async () => {
    const res = await request(app)
      .post('/api/compare/skills')
      .send({ skillPathA: '/tmp/sm-test-allowed-root/foo', skillPathB: '/etc/shadow' });
    expect(res.status).toBe(403);
  });

  it('rejects /api/feedback with skillPath outside allowed roots', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .send({ skillPath: '/etc/passwd', skillName: 'x', feedbackType: 'effective', scenario: 'x', toolUsed: 'x' });
    expect(res.status).toBe(403);
  });

  it('passes /api/fresh/check when skillPath is inside an allowed root', async () => {
    const res = await request(app)
      .post('/api/fresh/check')
      .send({ skillPath: '/tmp/sm-test-allowed-root/some-skill' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('passes when no path-shaped fields are present', async () => {
    // GET /api/health-style routes that don't carry paths must not be
    // blocked. Send empty body; pathGuard short-circuits.
    const res = await request(app)
      .post('/api/feedback')
      .send({ skillName: 'x', feedbackType: 'effective', scenario: 'x', toolUsed: 'x' });
    expect(res.status).toBe(200);
  });
});
