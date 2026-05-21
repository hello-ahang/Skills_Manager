import { Router, Request, Response } from 'express';
import archiver from 'archiver';
import multer from 'multer';
import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';
import { safeUnzipFile } from '../utils/safeUnzip.js';
import { log } from '../utils/logger.js';

const router = Router();

const USER_DATA_DIR = path.join(os.homedir(), '.skills-manager');
const TEMP_DIR = path.join(os.tmpdir(), 'skills-manager-backup');

const upload = multer({
  dest: path.join(os.tmpdir(), 'skills-manager-backup-uploads'),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.zip') {
      cb(null, true);
    } else {
      cb(new Error(`Only .zip files are allowed, got: ${ext}`));
    }
  },
});

function tsForFilename(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

// POST /api/backup/export - Export ~/.skills-manager/ as a ZIP
router.post('/export', async (_req: Request, res: Response) => {
  try {
    if (!await fs.pathExists(USER_DATA_DIR)) {
      await fs.ensureDir(USER_DATA_DIR);
    }

    const filename = `skills-manager-backup-${tsForFilename()}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      log.error({ err }, '[backup] archive error');
      try {
        res.status(500).end();
      } catch { /* ignore */ }
    });

    archive.pipe(res);
    archive.directory(USER_DATA_DIR, false, (entry) => {
      // Exclude any security.json — root-level OR nested anywhere in the
      // archive — so credentials cannot be carried into other machines.
      // The previous `entry.name === 'security.json'` only matched at the
      // archive root, leaking nested copies (e.g. inside a sub-tree backup).
      const name = entry.name || '';
      if (name === 'security.json' || name.endsWith('/security.json') || name.endsWith('\\security.json')) return false;
      return entry;
    });
    await archive.finalize();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to export backup';
    res.status(500).json({ error: message });
  }
});

// POST /api/backup/import - Import a previously exported ZIP
router.post('/import', upload.single('file'), async (req: Request, res: Response) => {
  let stagingDir: string | null = null;
  let oldDirRenamedTo: string | null = null;

  try {
    if (!req.file) {
      res.status(400).json({ error: '未上传备份文件' });
      return;
    }

    await fs.ensureDir(TEMP_DIR);
    stagingDir = path.join(TEMP_DIR, `restore-${uuidv4()}`);
    await fs.ensureDir(stagingDir);

    await safeUnzipFile(req.file.path, stagingDir);

    const userConfigCandidate = path.join(stagingDir, 'user-config.json');
    if (!await fs.pathExists(userConfigCandidate)) {
      res.status(400).json({ error: '备份文件无效：缺少 user-config.json' });
      return;
    }

    if (await fs.pathExists(USER_DATA_DIR)) {
      const backupOld = `${USER_DATA_DIR}.bak-${tsForFilename()}-${uuidv4().slice(0, 8)}`;
      await fs.rename(USER_DATA_DIR, backupOld);
      oldDirRenamedTo = backupOld;
    }

    await fs.ensureDir(path.dirname(USER_DATA_DIR));
    await fs.copy(stagingDir, USER_DATA_DIR);

    // Preserve existing security.json if it was renamed alongside the old data dir
    if (oldDirRenamedTo) {
      const oldSecurity = path.join(oldDirRenamedTo, 'security.json');
      const newSecurity = path.join(USER_DATA_DIR, 'security.json');
      if (!(await fs.pathExists(newSecurity)) && (await fs.pathExists(oldSecurity))) {
        await fs.copy(oldSecurity, newSecurity);
      }
    }

    res.json({
      success: true,
      message: '备份已恢复，请重启 Skills Manager 以加载新的数据',
      previousDataDir: oldDirRenamedTo,
    });
  } catch (error) {
    if (oldDirRenamedTo) {
      try {
        if (await fs.pathExists(USER_DATA_DIR)) {
          await fs.remove(USER_DATA_DIR);
        }
        await fs.rename(oldDirRenamedTo, USER_DATA_DIR);
      } catch (rollbackErr) {
        log.error({ err: rollbackErr }, '[backup] rollback failed');
      }
    }
    const message = error instanceof Error ? error.message : 'Failed to import backup';
    res.status(500).json({ error: message });
  } finally {
    if (req.file?.path) {
      await fs.remove(req.file.path).catch(() => {});
    }
    if (stagingDir) {
      await fs.remove(stagingDir).catch(() => {});
    }
  }
});

export default router;
