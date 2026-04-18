import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { ImportHistoryItem } from '../../src/types/index.js';

const USER_CONFIG_DIR = path.join(os.homedir(), '.skills-manager');
const HISTORY_PATH = path.join(USER_CONFIG_DIR, 'import-history.json');
const MAX_HISTORY_ITEMS = 100;

async function readHistory(): Promise<ImportHistoryItem[]> {
  await fs.ensureDir(USER_CONFIG_DIR);
  if (await fs.pathExists(HISTORY_PATH)) {
    try {
      return await fs.readJson(HISTORY_PATH);
    } catch {
      return [];
    }
  }
  return [];
}

async function writeHistory(history: ImportHistoryItem[]): Promise<void> {
  await fs.ensureDir(USER_CONFIG_DIR);
  await fs.writeJson(HISTORY_PATH, history, { spaces: 2 });
}

export async function addHistory(item: ImportHistoryItem): Promise<ImportHistoryItem> {
  const history = await readHistory();

  // Assign ID if not provided
  if (!item.id) {
    item.id = uuidv4();
  }

  // Add to beginning (newest first)
  history.unshift(item);

  // Enforce limit
  if (history.length > MAX_HISTORY_ITEMS) {
    history.splice(MAX_HISTORY_ITEMS);
  }

  await writeHistory(history);
  return item;
}

export async function getHistory(
  source?: string,
  limit?: number
): Promise<ImportHistoryItem[]> {
  let history = await readHistory();

  // Filter by source if provided
  if (source) {
    history = history.filter(h => h.source === source);
  }

  // Apply limit
  if (limit && limit > 0) {
    history = history.slice(0, limit);
  }

  return history;
}

export async function deleteHistory(id: string): Promise<void> {
  let history = await readHistory();
  history = history.filter(h => h.id !== id);
  await writeHistory(history);
}

export async function clearHistory(): Promise<void> {
  await writeHistory([]);
}