/**
 * File-backed persistence for generated skill cards.
 *
 * Layout under ~/.skills-manager/cards/:
 *   index.json          - array of CardSummary (no html/data, fast list)
 *   <uuid>.json         - { id, skillName, ..., html, data } (full payload)
 *
 * Concurrency: index.json is written atomically (tmp + rename), same pattern
 * as versionService.writeIndex. Card payload files are write-once per id;
 * we never edit a card in place (regenerate creates a new id).
 *
 * Retention: each skillPath keeps the most recent MAX_PER_SKILL cards.
 * Older entries are deleted when a new card is saved.
 */
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import type { SkillCardData } from './skillCardService.js';
import { atomicWriteJson } from '../utils/json.js';
import { log } from '../utils/logger.js';

// Resolved per-call so tests can override SM_CARDS_DIR in beforeEach.
function cardsDir(): string {
  return process.env.SM_CARDS_DIR || path.join(os.homedir(), '.skills-manager', 'cards');
}
function indexPath(): string {
  return path.join(cardsDir(), 'index.json');
}
const MAX_PER_SKILL = 5;
const MAX_TOTAL = 500;

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Normalize skillPath so Windows backslashes don't cause cache misses on
// getLatestForSkillPath. The route layer joins with path.join which can
// produce '\' on Win32, but cards saved earlier may have used '/' (or
// vice versa across platforms / git sync). We canonicalize to forward
// slashes both when writing and when looking up.
function normalizeSkillPath(p: string): string {
  return p.replace(/\\/g, '/');
}

export interface CardSummary {
  id: string;
  skillName: string;
  skillPath: string;
  title: string;
  aiUsed: boolean;
  hasRubric: boolean;
  generatedAt: string;
}

export interface StoredCard extends CardSummary {
  html: string;
  data: SkillCardData;
}

async function ensureDir(): Promise<void> {
  await fs.ensureDir(cardsDir());
}

async function readIndex(): Promise<CardSummary[]> {
  try {
    const data = await fs.readJson(indexPath());
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    log.warn({ err: err instanceof Error ? err.message : String(err) }, '[cardStorage] index.json corrupt, treating as empty');
    return [];
  }
}

async function writeIndex(entries: CardSummary[]): Promise<void> {
  await ensureDir();
  await atomicWriteJson(indexPath(), entries);
}

function cardPath(id: string): string {
  if (!ID_RE.test(id)) {
    throw new Error(`Invalid card id: ${id}`);
  }
  return path.join(cardsDir(), `${id}.json`);
}

function toSummary(card: StoredCard): CardSummary {
  return {
    id: card.id,
    skillName: card.skillName,
    skillPath: card.skillPath,
    title: card.title,
    aiUsed: card.aiUsed,
    hasRubric: card.hasRubric,
    generatedAt: card.generatedAt,
  };
}

/** Persist a card and prune anything beyond MAX_PER_SKILL / MAX_TOTAL. */
export async function saveCard(
  skillPath: string,
  html: string,
  data: SkillCardData,
): Promise<{ id: string; generatedAt: string }> {
  await ensureDir();

  const id = uuidv4();
  const generatedAt = new Date().toISOString();

  const stored: StoredCard = {
    id,
    skillName: data.name,
    skillPath: normalizeSkillPath(skillPath),
    title: data.title,
    aiUsed: data.aiUsed,
    hasRubric: !!data.rubric,
    generatedAt,
    html,
    data,
  };

  // Payload file (new uuid path) and existing index.json are independent —
  // write payload + load existing index in parallel. Index write must wait
  // for both: payload-first ordering matters if the index write fails
  // (orphan payload is recoverable; orphan index entry isn't).
  const [, index] = await Promise.all([
    fs.writeJson(cardPath(id), stored, { spaces: 2 }),
    readIndex(),
  ]);
  index.unshift(toSummary(stored));

  // Per-skill retention; normalize the key so legacy backslash entries
  // group with current forward-slash entries on lookup.
  const perSkillCount: Record<string, number> = {};
  const toKeep: CardSummary[] = [];
  const toRemove: CardSummary[] = [];
  for (const entry of index) {
    const key = normalizeSkillPath(entry.skillPath);
    const count = perSkillCount[key] || 0;
    if (count < MAX_PER_SKILL && toKeep.length < MAX_TOTAL) {
      toKeep.push(entry);
      perSkillCount[key] = count + 1;
    } else {
      toRemove.push(entry);
    }
  }

  await Promise.all(toRemove.map(entry =>
    fs.remove(cardPath(entry.id)).catch(err => {
      log.warn({ id: entry.id, err: err instanceof Error ? err.message : String(err) }, '[cardStorage] failed to delete pruned card payload');
    }),
  ));

  await writeIndex(toKeep);
  return { id, generatedAt };
}

export async function listCards(): Promise<CardSummary[]> {
  return readIndex();
}

export async function getCard(id: string): Promise<StoredCard | null> {
  if (!ID_RE.test(id)) return null;
  try {
    return await fs.readJson(cardPath(id)) as StoredCard;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    log.warn({ id, err: err instanceof Error ? err.message : String(err) }, '[cardStorage] payload read failed');
    return null;
  }
}

/** Most recent card for `skillPath`, so the dialog can skip a fresh AI run. */
export async function getLatestForSkillPath(skillPath: string): Promise<StoredCard | null> {
  const needle = normalizeSkillPath(skillPath);
  const index = await readIndex();
  const match = index.find(c => normalizeSkillPath(c.skillPath) === needle);
  if (!match) return null;
  return getCard(match.id);
}

export async function deleteCard(id: string): Promise<boolean> {
  if (!ID_RE.test(id)) return false;
  const index = await readIndex();
  const filtered = index.filter(c => c.id !== id);
  if (filtered.length === index.length) return false;

  try {
    await fs.remove(cardPath(id));
  } catch (err) {
    log.warn({ id, err: err instanceof Error ? err.message : String(err) }, '[cardStorage] payload delete failed (continuing)');
  }
  await writeIndex(filtered);
  return true;
}
