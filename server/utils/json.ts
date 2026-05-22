import fs from 'fs-extra';

/**
 * Parse a JSON object string defensively. Returns the parsed record on
 * success or undefined on any failure (malformed JSON, non-object payload,
 * etc.). Used by service layers when reading optional `metadata` columns
 * out of SQLite — the column is `TEXT NULL` and may contain invalid JSON
 * if a foreign tool wrote to the DB.
 */
export function safeParseJsonRecord(text: string): Record<string, string> | undefined {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * Atomic JSON write: stage to a tmp sibling, then rename. Prevents partial
 * or concurrent writers from leaving a half-formed file on disk. Used by
 * any service that maintains an on-disk index/state file
 * (versionService.index, cardStorageService.index, etc.).
 *
 * The pid+timestamp suffix is collision-protection for two writes from the
 * same process racing on the same path.
 */
export async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeJson(tmpPath, data, { spaces: 2 });
  await fs.rename(tmpPath, filePath);
}
