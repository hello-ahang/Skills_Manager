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
