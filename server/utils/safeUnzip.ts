import fs from 'fs-extra';
import path from 'path';
import unzipper from 'unzipper';
import type { Readable } from 'stream';
import { log } from './logger.js';

export interface SafeUnzipLimits {
  maxTotalUncompressedBytes: number;
  maxEntries: number;
  maxSingleEntryBytes: number;
}

// Decompression-bomb thresholds. Tuned for legitimate skill backups
// (typically <50MB uncompressed, hundreds of files) with generous headroom.
export const SAFE_UNZIP_LIMITS: SafeUnzipLimits = {
  maxTotalUncompressedBytes: 2 * 1024 * 1024 * 1024, // 2 GiB
  maxEntries: 50_000,
  maxSingleEntryBytes: 1 * 1024 * 1024 * 1024,        // 1 GiB
};

export interface SafeUnzipResult {
  written: number;
  skipped: string[];
}

export function isInsideRoot(target: string, root: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  if (resolvedTarget === resolvedRoot) return true;
  const rel = path.relative(resolvedRoot, resolvedTarget);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return false;
  return true;
}

export async function safeUnzipFromStream(
  stream: Readable,
  extractDir: string,
  limits: SafeUnzipLimits = SAFE_UNZIP_LIMITS,
): Promise<SafeUnzipResult> {
  await fs.ensureDir(extractDir);
  const root = path.resolve(extractDir);
  const skipped: string[] = [];
  let written = 0;
  let totalUncompressedBytes = 0;
  let entryCount = 0;
  let aborted: Error | null = null;

  await new Promise<void>((resolve, reject) => {
    const parser = stream.pipe(unzipper.Parse());

    const fail = (reason: string, ctx: Record<string, unknown> = {}) => {
      const err = new Error(reason);
      aborted = err;
      log.error({ ...ctx }, `[safeUnzip] ${reason}`);
      stream.unpipe?.(parser);
      try { (parser as unknown as { destroy?: () => void }).destroy?.(); } catch { /* ignore */ }
      reject(err);
    };

    parser
      .on('entry', (entry: unzipper.Entry) => {
        if (aborted) {
          entry.autodrain();
          return;
        }

        const entryPath = entry.path || '';

        // Limit: total entry count.
        entryCount += 1;
        if (entryCount > limits.maxEntries) {
          entry.autodrain();
          fail('Zip entry count exceeds safe limit', {
            limit: limits.maxEntries,
          });
          return;
        }

        // Reject anything that isn't a plain file or directory entry.
        // unzipper only surfaces 'File' | 'Directory' for standard zip
        // entries, but defending here means any future symlink/special
        // entry types are autodrained instead of materialized.
        if (entry.type !== 'File' && entry.type !== 'Directory') {
          skipped.push(entryPath);
          entry.autodrain();
          return;
        }

        const targetPath = path.resolve(root, entryPath);

        if (!isInsideRoot(targetPath, root) || entryPath.includes('\0')) {
          skipped.push(entryPath);
          entry.autodrain();
          return;
        }

        if (entry.type === 'Directory') {
          fs.ensureDir(targetPath)
            .then(() => entry.autodrain())
            .catch(() => entry.autodrain());
          return;
        }

        // Pre-flight check: zip header advertises uncompressedSize. Reject
        // before we open a write stream — that way attacker-supplied entries
        // can never start materializing on disk. We still verify the running
        // total inside the data callback as a backstop in case a malformed
        // header lies about its size.
        const declaredSize = (entry as unknown as { vars?: { uncompressedSize?: number } }).vars?.uncompressedSize ?? 0;
        if (declaredSize > limits.maxSingleEntryBytes) {
          entry.autodrain();
          fail('Zip entry exceeds single-file size limit', {
            entryPath,
            declared: declaredSize,
            limit: limits.maxSingleEntryBytes,
          });
          return;
        }
        if (totalUncompressedBytes + declaredSize > limits.maxTotalUncompressedBytes) {
          entry.autodrain();
          fail('Zip total uncompressed size exceeds safe limit', {
            limit: limits.maxTotalUncompressedBytes,
          });
          return;
        }

        const parent = path.dirname(targetPath);
        fs.ensureDir(parent)
          .then(() => {
            const writer = fs.createWriteStream(targetPath);
            let entryBytes = 0;

            // Backstop: defend against zip headers that lie about size by
            // also counting actual decoded bytes. unzipper buffers may emit
            // data either before or after pipe attaches, so we treat any
            // overshoot as a hard fail and tear down both writer and entry.
            entry.on('data', (chunk: Buffer) => {
              if (aborted) return;
              entryBytes += chunk.length;
              totalUncompressedBytes += chunk.length;

              if (entryBytes > limits.maxSingleEntryBytes) {
                writer.destroy();
                entry.autodrain();
                fail('Zip entry exceeds single-file size limit (post-decode)', {
                  entryPath,
                  limit: limits.maxSingleEntryBytes,
                });
                return;
              }
              if (totalUncompressedBytes > limits.maxTotalUncompressedBytes) {
                writer.destroy();
                entry.autodrain();
                fail('Zip total uncompressed size exceeds safe limit (post-decode)', {
                  limit: limits.maxTotalUncompressedBytes,
                });
                return;
              }
            });

            entry
              .pipe(writer)
              .on('finish', () => {
                written += 1;
              })
              .on('error', (err) => {
                log.error({ err, entryPath }, '[safeUnzip] write failed');
              });
          })
          .catch((err) => {
            log.error({ err, parent }, '[safeUnzip] ensureDir failed');
            entry.autodrain();
          });
      })
      .on('close', () => {
        if (aborted) return;
        resolve();
      })
      .on('error', (err) => {
        if (aborted) return;
        reject(err);
      });
  });

  if (skipped.length > 0) {
    log.warn({ skipped: skipped.slice(0, 10) }, `[safeUnzip] Skipped ${skipped.length} unsafe entries`);
  }

  return { written, skipped };
}

export async function safeUnzipFile(
  zipPath: string,
  extractDir: string,
  limits: SafeUnzipLimits = SAFE_UNZIP_LIMITS,
): Promise<SafeUnzipResult> {
  const stream = fs.createReadStream(zipPath);
  return safeUnzipFromStream(stream, extractDir, limits);
}
