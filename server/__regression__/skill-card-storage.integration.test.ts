/**
 * Integration tests for the persistence side of /api/skill-card —
 * list / by-path / :id / :id/view / DELETE.
 *
 * Why this file is separate from skill-card.integration.test.ts:
 * that one locks the pathGuard contract on /generate;
 * this one locks endpoint shape and content-type/CSP headers for the
 * read+delete surface that the card library page depends on.
 *
 * SM_CARDS_DIR is overridden per-test so we never touch the user's real
 * ~/.skills-manager/cards. We seed cards through saveCard() directly
 * rather than hitting /generate (which would require a real SKILL.md
 * fixture + the full skillCardService stack).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import skillCardRouter from '../routes/skill-card.js';
import { saveCard } from '../services/cardStorageService.js';
import type { SkillCardData } from '../services/skillCardService.js';

let tmpDir: string;
let app: express.Express;

function makeData(name: string, overrides: Partial<SkillCardData> = {}): SkillCardData {
  return {
    name,
    title: `${name} 的一句话价值`,
    capabilities: ['能力 A'],
    scenarios: ['场景 1'],
    examples: [],
    related: [],
    references: [],
    aiUsed: false,
    ...overrides,
  };
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sm-card-route-'));
  process.env.SM_CARDS_DIR = path.join(tmpDir, 'cards');

  app = express();
  app.use(express.json());
  app.use('/api/skill-card', skillCardRouter);
});

afterEach(async () => {
  delete process.env.SM_CARDS_DIR;
  await fs.remove(tmpDir);
});

describe('/api/skill-card persistence endpoints', () => {
  describe('GET /list', () => {
    it('returns empty array when no cards saved', async () => {
      const res = await request(app).get('/api/skill-card/list');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ cards: [] });
    });

    it('returns summary fields only — never html or data', async () => {
      await saveCard('/tmp/x', '<html>BIG</html>', makeData('x', {
        rubric: { overall: 80, grade: 'B' },
      }));
      const res = await request(app).get('/api/skill-card/list');
      expect(res.status).toBe(200);
      expect(res.body.cards).toHaveLength(1);
      const summary = res.body.cards[0];
      // CardSummary shape
      expect(summary).toHaveProperty('id');
      expect(summary).toHaveProperty('skillName', 'x');
      expect(summary).toHaveProperty('skillPath', '/tmp/x');
      expect(summary).toHaveProperty('aiUsed', false);
      expect(summary).toHaveProperty('hasRubric', true);
      // Critical: payload must NOT leak through list (would defeat the
      // point of having a separate summary vs storage record).
      expect(summary).not.toHaveProperty('html');
      expect(summary).not.toHaveProperty('data');
    });
  });

  describe('GET /by-path', () => {
    it('returns 400 when skillPath is missing', async () => {
      const res = await request(app).get('/api/skill-card/by-path');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/i);
    });

    it('returns { card: null } when no card exists for the path', async () => {
      const res = await request(app)
        .get('/api/skill-card/by-path')
        .query({ skillPath: '/tmp/never-seen' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ card: null });
    });

    it('returns the most recent card for a skillPath, with full payload', async () => {
      await saveCard('/tmp/foo', '<html>v1</html>', makeData('foo'));
      await new Promise(r => setTimeout(r, 5));
      const { id: latest } = await saveCard('/tmp/foo', '<html>v2</html>', makeData('foo'));
      const res = await request(app)
        .get('/api/skill-card/by-path')
        .query({ skillPath: '/tmp/foo' });
      expect(res.status).toBe(200);
      expect(res.body.card.id).toBe(latest);
      expect(res.body.card.html).toBe('<html>v2</html>');
    });
  });

  describe('GET /:id', () => {
    it('returns full StoredCard for a valid id', async () => {
      const { id } = await saveCard('/tmp/x', '<html>X</html>', makeData('x'));
      const res = await request(app).get(`/api/skill-card/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.card.html).toBe('<html>X</html>');
      expect(res.body.card.data.name).toBe('x');
    });

    it('returns 404 for an unknown but well-formed id', async () => {
      const res = await request(app).get('/api/skill-card/11111111-2222-3333-4444-555555555555');
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('returns 404 (not 500) for a malformed id — id validation is silent', async () => {
      // Regression: ID_RE rejection inside getCard() returns null, which
      // the route maps to 404. We must not let an Invalid id Error bubble
      // up as a 500.
      const res = await request(app).get('/api/skill-card/not-a-uuid');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /:id/view', () => {
    it('serves the raw HTML with text/html content-type', async () => {
      const { id } = await saveCard('/tmp/x', '<html>HELLO</html>', makeData('x'));
      const res = await request(app).get(`/api/skill-card/${id}/view`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/^text\/html/);
      expect(res.text).toBe('<html>HELLO</html>');
    });

    it('sets Content-Security-Policy: sandbox to neutralize any embedded script', async () => {
      // Regression: this is the second XSS defense layer (the first is
      // escapeHtml at render time). Dropping the CSP would defeat the
      // promise of "safe to open in a new tab".
      const { id } = await saveCard('/tmp/x', '<html/>', makeData('x'));
      const res = await request(app).get(`/api/skill-card/${id}/view`);
      expect(res.headers['content-security-policy']).toContain('sandbox');
    });

    it('returns 404 for unknown id', async () => {
      const res = await request(app).get('/api/skill-card/11111111-2222-3333-4444-555555555555/view');
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /:id', () => {
    it('deletes a card and subsequent GET returns 404', async () => {
      const { id } = await saveCard('/tmp/x', '<html/>', makeData('x'));
      const del = await request(app).delete(`/api/skill-card/${id}`);
      expect(del.status).toBe(200);
      expect(del.body).toEqual({ deleted: true });

      const get = await request(app).get(`/api/skill-card/${id}`);
      expect(get.status).toBe(404);

      const list = await request(app).get('/api/skill-card/list');
      expect(list.body.cards).toHaveLength(0);
    });

    it('returns { deleted: false } for unknown id (no throw)', async () => {
      const res = await request(app).delete('/api/skill-card/11111111-2222-3333-4444-555555555555');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ deleted: false });
    });

    it('returns { deleted: false } for malformed id', async () => {
      const res = await request(app).delete('/api/skill-card/not-a-uuid');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ deleted: false });
    });
  });
});
