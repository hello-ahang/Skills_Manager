import fs from 'fs-extra';
import path from 'path';

interface CreateLinkOptions {
  source: string;
  target: string;
  backup?: boolean;
}

interface LinkInfo {
  exists: boolean;
  isSymlink: boolean;
  isDirectory: boolean;
  linkedTo?: string;
}

export async function getLinkInfo(targetPath: string): Promise<LinkInfo> {
  try {
    const stat = await fs.lstat(targetPath);
    if (stat.isSymbolicLink()) {
      const linkedTo = await fs.readlink(targetPath);
      return { exists: true, isSymlink: true, isDirectory: false, linkedTo };
    }
    if (stat.isDirectory()) {
      return { exists: true, isSymlink: false, isDirectory: true };
    }
    return { exists: true, isSymlink: false, isDirectory: false };
  } catch {
    return { exists: false, isSymlink: false, isDirectory: false };
  }
}

export async function createSymlink(options: CreateLinkOptions): Promise<void> {
  const { source, target, backup = true } = options;

  // 1. Check source exists
  if (!await fs.pathExists(source)) {
    throw new Error(`Source directory does not exist: ${source}`);
  }

  // 2. Check target status
  const linkInfo = await getLinkInfo(target);

  if (linkInfo.exists) {
    if (linkInfo.isSymlink) {
      // Already a symlink, check if pointing to correct target
      if (linkInfo.linkedTo === source) {
        return; // Already correctly linked
      }
      // Remove old link
      await fs.remove(target);
    } else if (linkInfo.isDirectory) {
      // Real directory exists
      if (backup) {
        const backupPath = `${target}_backup_${Date.now()}`;
        await fs.move(target, backupPath);
      } else {
        throw new Error(`Target path already exists and is a directory: ${target}`);
      }
    }
  }

  // 3. Ensure parent directory exists
  await fs.ensureDir(path.dirname(target));

  // 4. Create symlink
  await fs.symlink(source, target, 'dir');
}

export async function removeSymlink(targetPath: string, restoreAsDirectory: boolean = false): Promise<void> {
  const linkInfo = await getLinkInfo(targetPath);

  if (!linkInfo.exists) {
    return; // Nothing to remove
  }

  if (linkInfo.isSymlink) {
    await fs.remove(targetPath);

    // Try to restore from the most recent backup
    const parentDir = path.dirname(targetPath);
    const baseName = path.basename(targetPath);
    const backupPrefix = `${baseName}_backup_`;

    try {
      const entries = await fs.readdir(parentDir);
      const backups = entries
        .filter((e) => e.startsWith(backupPrefix))
        .sort()
        .reverse(); // Most recent first (timestamp-based naming)

      if (backups.length > 0) {
        const latestBackup = path.join(parentDir, backups[0]);
        await fs.move(latestBackup, targetPath);
        return; // Restored from backup
      }
    } catch {
      // If reading parent dir fails, fall through to default behavior
    }

    // No backup found, create empty directory if requested
    if (restoreAsDirectory) {
      await fs.ensureDir(targetPath);
    }
  }
}

export async function verifySymlink(targetPath: string): Promise<boolean> {
  const linkInfo = await getLinkInfo(targetPath);
  if (!linkInfo.isSymlink || !linkInfo.linkedTo) return false;

  // Check if the link target actually exists
  return fs.pathExists(linkInfo.linkedTo);
}
