/**
 * Integration test for /api/skill-card/generate — verifies pathGuard
 * blocks out-of-roots skillPath and the happy path returns html+data.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { pathGuard } from '../middleware/pathGuard.js';
import skillCardRouter from '../routes/skill-card.js';

function buildApp(allowedRoots: string[]) {
  const app = express();
  app.use(express.json());
  app.use('/api', pathGuard(async () => allowedRoots));
  app.use('/api/skill-card', skillCardRouter);
  return app;
}

describe('/api/skill-card/generate pathGuard (regression)', () => {
  let app: express.Express;

  beforeAll(() => {
    app = buildApp(['/tmp/sm-card-allowed-root']);
  });

  it('rejects /etc/ absolute path', async () => {
    const res = await request(app)
      .post('/api/skill-card/generate')
      .send({ skillPath: '/etc/', includeAI: false });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/outside the allowed directories/i);
  });

  it('rejects /etc/passwd', async () => {
    const res = await request(app)
      .post('/api/skill-card/generate')
      .send({ skillPath: '/etc/passwd', includeAI: false });
    expect(res.status).toBe(403);
  });

  it('returns 400 when skillPath missing', async () => {
    const res = await request(app)
      .post('/api/skill-card/generate')
      .send({ includeAI: false });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 404 when skillPath inside allowed root but does not exist', async () => {
    const res = await request(app)
      .post('/api/skill-card/generate')
      .send({ skillPath: '/tmp/sm-card-allowed-root/nonexistent', includeAI: false });
    expect(res.status).toBe(404);
  });
});
