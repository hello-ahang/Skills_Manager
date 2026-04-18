import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import type { ImportStats, ImportSource } from '../../src/types/index.js';

const USER_CONFIG_DIR = path.join(os.homedir(), '.skills-manager');
const HISTORY_PATH = path.join(USER_CONFIG_DIR, 'import-history.json');

export async function getImportStats(): Promise<ImportStats> {
  let history: any[] = [];

  if (await fs.pathExists(HISTORY_PATH)) {
    try {
      history = await fs.readJson(HISTORY_PATH);
    } catch {
      history = [];
    }
  }

  const totalImports = history.length;

  // Count by source
  const sourceMap = new Map<string, number>();
  let totalSuccess = 0;
  let totalDuration = 0;

  for (const item of history) {
    const source = item.source || 'unknown';
    sourceMap.set(source, (sourceMap.get(source) || 0) + 1);

    if (item.result) {
      totalSuccess += item.result.successCount || 0;
      totalDuration += item.result.duration || 0;
    }
  }

  const bySource: { source: ImportSource; count: number }[] = [];
  for (const [source, count] of sourceMap) {
    bySource.push({ source: source as ImportSource, count });
  }
  bySource.sort((a, b) => b.count - a.count);

  // Calculate success rate
  const totalAttempted = history.reduce((sum, item) => {
    return sum + (item.result?.totalCount || 0);
  }, 0);
  const successRate = totalAttempted > 0 ? (totalSuccess / totalAttempted) * 100 : 100;

  // Average duration
  const avgDuration = totalImports > 0 ? totalDuration / totalImports : 0;

  // Recent trend (last 30 days)
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const dateMap = new Map<string, number>();

  for (let i = 0; i < 30; i++) {
    const date = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    dateMap.set(dateStr, 0);
  }

  for (const item of history) {
    if (!item.timestamp) continue;
    const dateStr = item.timestamp.split('T')[0];
    if (dateMap.has(dateStr)) {
      dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
    }
  }

  const recentTrend: { date: string; count: number }[] = [];
  for (const [date, count] of dateMap) {
    recentTrend.push({ date, count });
  }
  recentTrend.sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalImports,
    bySource,
    successRate: Math.round(successRate * 100) / 100,
    avgDuration: Math.round(avgDuration),
    recentTrend,
  };
}