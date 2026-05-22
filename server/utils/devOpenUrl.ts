import fs from 'fs';

const MIN_TOKEN_LENGTH = 16;

/**
 * vite.config.ts uses this to decide what `server.open` should be in dev.
 * Dev mode runs Vite (5173) and the backend (3001) on different origins, so
 * localStorage tokens captured via `?token=` on 3001 don't carry over. If
 * security.json has a valid token we inject it into the auto-open URL so the
 * frontend's captureTokenFromUrl() writes it to the 5173 origin's storage on
 * first load. Falls back to `true` when token is unavailable — caller still
 * needs to deal with the resulting 401s, but at least the dev server boots.
 */
export function getDevOpenUrl(securityPath: string): string | true {
  let raw: string;
  try {
    raw = fs.readFileSync(securityPath, 'utf-8');
  } catch {
    return true;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return true;
  }

  if (!parsed || typeof parsed !== 'object') return true;
  const token = (parsed as { token?: unknown }).token;
  if (typeof token !== 'string' || token.length < MIN_TOKEN_LENGTH) return true;

  return `/?token=${encodeURIComponent(token)}`;
}
