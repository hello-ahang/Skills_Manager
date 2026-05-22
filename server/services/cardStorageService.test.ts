/**
 * Unit tests for cardStorageService — save / list / get / by-path lookup /
 * delete / retention pruning.
 *
 * Uses SM_CARDS_DIR env override to isolate from the real ~/.skills-manager.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import type { SkillCardData } from './skillCardService.js';

let tmpDir: string;

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
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sm-card-store-'));
  process.env.SM_CARDS_DIR = path.join(tmpDir, 'cards');
});

afterEach(async () => {
  delete process.env.SM_CARDS_DIR;
  await fs.remove(tmpDir);
});

async function freshImport() {
  // cardStorageService resolves SM_CARDS_DIR per-call (cardsDir()), so a
  // plain import suffices — no need to bust the module cache.
  return import('./cardStorageService.js');
}

describe('cardStorageService', () => {
  it('saves a card and returns a uuid id', async () => {
    const { saveCard } = await freshImport();
    const { id, generatedAt } = await saveCard('/tmp/skill-a', '<html>...</html>', makeData('skill-a'));
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(new Date(generatedAt).toString()).not.toBe('Invalid Date');
    expect(await fs.pathExists(path.join(tmpDir, 'cards', `${id}.json`))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'cards', 'index.json'))).toBe(true);
  });

  it('round-trips a card through save → list → getCard', async () => {
    const { saveCard, listCards, getCard } = await freshImport();
    const { id } = await saveCard('/tmp/x', '<html>X</html>', makeData('x'));
    const list = await listCards();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id, skillName: 'x', skillPath: '/tmp/x', aiUsed: false, hasRubric: false });
    const card = await getCard(id);
    expect(card?.html).toBe('<html>X</html>');
    expect(card?.data.name).toBe('x');
  });

  it('returns null for unknown id', async () => {
    const { getCard } = await freshImport();
    const card = await getCard('11111111-2222-3333-4444-555555555555');
    expect(card).toBeNull();
  });

  it('rejects malformed id without filesystem touch', async () => {
    const { getCard } = await freshImport();
    expect(await getCard('../etc/passwd')).toBeNull();
    expect(await getCard('not-a-uuid')).toBeNull();
    expect(await getCard('')).toBeNull();
  });

  it('list is sorted newest-first', async () => {
    const { saveCard, listCards } = await freshImport();
    const a = await saveCard('/tmp/a', '<html>a</html>', makeData('a'));
    // Ensure ordering by inserting after a tick
    await new Promise(r => setTimeout(r, 5));
    const b = await saveCard('/tmp/b', '<html>b</html>', makeData('b'));
    const list = await listCards();
    expect(list[0].id).toBe(b.id);
    expect(list[1].id).toBe(a.id);
  });

  it('getLatestForSkillPath returns the newest card for that skillPath only', async () => {
    const { saveCard, getLatestForSkillPath } = await freshImport();
    await saveCard('/tmp/a', '<html>a-v1</html>', makeData('a'));
    await new Promise(r => setTimeout(r, 5));
    const { id: v2Id } = await saveCard('/tmp/a', '<html>a-v2</html>', makeData('a'));
    await saveCard('/tmp/b', '<html>b</html>', makeData('b'));

    const latest = await getLatestForSkillPath('/tmp/a');
    expect(latest?.id).toBe(v2Id);
    expect(latest?.html).toBe('<html>a-v2</html>');

    expect(await getLatestForSkillPath('/tmp/never-saved')).toBeNull();
  });

  it('prunes per-skill history beyond MAX_PER_SKILL (5)', async () => {
    const { saveCard, listCards } = await freshImport();
    // Save 7 cards for the same skillPath
    for (let i = 0; i < 7; i++) {
      await saveCard('/tmp/loop', `<html>v${i}</html>`, makeData('loop'));
      await new Promise(r => setTimeout(r, 2));
    }
    const list = await listCards();
    expect(list.length).toBe(5);
    // Newest 5 should remain (v6, v5, v4, v3, v2)
    expect(list[0].skillPath).toBe('/tmp/loop');
    // Verify the oldest two payload files got deleted from disk
    const cardFiles = (await fs.readdir(path.join(tmpDir, 'cards'))).filter(f => f.endsWith('.json') && f !== 'index.json');
    expect(cardFiles.length).toBe(5);
  });

  it('deleteCard removes payload + index entry, returns true', async () => {
    const { saveCard, deleteCard, listCards, getCard } = await freshImport();
    const { id } = await saveCard('/tmp/x', '<html>X</html>', makeData('x'));
    expect(await deleteCard(id)).toBe(true);
    expect(await listCards()).toHaveLength(0);
    expect(await getCard(id)).toBeNull();
    expect(await fs.pathExists(path.join(tmpDir, 'cards', `${id}.json`))).toBe(false);
  });

  it('deleteCard returns false for unknown id (no throw)', async () => {
    const { deleteCard } = await freshImport();
    expect(await deleteCard('11111111-2222-3333-4444-555555555555')).toBe(false);
    expect(await deleteCard('not-a-uuid')).toBe(false);
  });

  it('captures hasRubric and aiUsed in the summary', async () => {
    const { saveCard, listCards } = await freshImport();
    await saveCard('/tmp/with-rubric', '<html/>', makeData('with-rubric', {
      aiUsed: true,
      rubric: { overall: 92, grade: 'A' },
    }));
    const list = await listCards();
    expect(list[0]).toMatchObject({ aiUsed: true, hasRubric: true });
  });

  it('tolerates a corrupt index.json by treating it as empty', async () => {
    const { saveCard, listCards } = await freshImport();
    await fs.ensureDir(path.join(tmpDir, 'cards'));
    await fs.writeFile(path.join(tmpDir, 'cards', 'index.json'), '{not json');
    // Should not throw; first save recovers the index
    const { id } = await saveCard('/tmp/x', '<html/>', makeData('x'));
    expect((await listCards())[0].id).toBe(id);
  });
});
