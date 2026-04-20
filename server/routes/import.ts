import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import {
  scanGitHub,
  scanGitee,
  scanGitLab,
  scanBitbucket,
  scanClawHub,
  scanLocal,
  scanZip,
  scanClipboard,
  executeImport,
  importBatch,
  importFromCSV,
  importFromJSON,
  exportToCSV,
  exportToJSON,
  checkConflicts,
  cleanupTempFiles,
  detectUrlType,
  getImportProviders,
  detectProvider,
} from '../services/importService.js';
import { getUserConfig, saveUserConfig } from '../services/configService.js';
import type { ImportOptions, ScannedSkill } from '../../src/types/index.js';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: path.join(os.tmpdir(), 'skills-manager-uploads'),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
  fileFilter: (_req, file, cb) => {
    const allowedExts = ['.zip', '.rar', '.7z', '.csv', '.json'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Allowed: ${allowedExts.join(', ')}`));
    }
  },
});

// ==================== Git Tokens ====================

// GET /api/import/git-tokens - Read git tokens from user local config
router.get('/git-tokens', async (_req: Request, res: Response) => {
  try {
    const userConfig = await getUserConfig();
    const tokens = userConfig.gitTokens || {};
    res.json({ github: tokens.github || '', gitee: tokens.gitee || '', gitlab: tokens.gitlab || '' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read git tokens' });
  }
});

// PUT /api/import/git-tokens - Save git tokens to user local config
router.put('/git-tokens', async (req: Request, res: Response) => {
  try {
    const { github, gitee, gitlab } = req.body;
    const userConfig = await getUserConfig();
    userConfig.gitTokens = {
      ...(userConfig.gitTokens || {}),
      ...(github !== undefined ? { github } : {}),
      ...(gitee !== undefined ? { gitee } : {}),
      ...(gitlab !== undefined ? { gitlab } : {}),
    };
    await saveUserConfig(userConfig);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save git tokens' });
  }
});

// ==================== Provider Endpoints ====================

// GET /api/import/providers - Get all registered import providers
router.get('/providers', async (_req: Request, res: Response) => {
  try {
    const providers = getImportProviders().map(p => ({
      id: p.id,
      name: p.name,
      icon: p.icon,
      group: p.group,
      requiresAuth: p.requiresAuth,
      authFields: p.authFields,
    }));
    res.json({ providers });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get providers' });
  }
});

// POST /api/import/scan/provider/:providerId - Universal scan endpoint via provider
router.post('/scan/provider/:providerId', async (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    const { input, options } = req.body;

    if (!input) {
      res.status(400).json({ error: 'Input is required' });
      return;
    }

    const providers = getImportProviders();
    const provider = providers.find(p => p.id === providerId);
    if (!provider) {
      res.status(404).json({ error: `Provider "${providerId}" not found` });
      return;
    }

    // Merge auth tokens from user config if provider needs auth
    let scanOptions = options || {};
    if (provider.requiresAuth || provider.authFields) {
      const userConfig = await getUserConfig();
      const tokenKey = providerId as keyof typeof userConfig.gitTokens;
      if (userConfig.gitTokens?.[tokenKey] && !scanOptions.token) {
        scanOptions = { ...scanOptions, token: userConfig.gitTokens[tokenKey] };
      }
    }

    const result = await provider.scan(input, scanOptions);
    res.json({ ...result, providerId });
  } catch (error) {
    const message = error instanceof Error ? error.message : `Failed to scan via provider`;
    res.status(500).json({ error: message });
  }
});

// POST /api/import/scan/auto-detect - Auto-detect provider from URL and scan
router.post('/scan/auto-detect', async (req: Request, res: Response) => {
  try {
    const { url, options } = req.body;
    if (!url) {
      res.status(400).json({ error: 'URL is required' });
      return;
    }

    const provider = detectProvider(url);
    if (!provider) {
      res.status(400).json({ error: 'No provider found for this URL. Supported: GitHub, Gitee, GitLab, Bitbucket, ClawHub' });
      return;
    }

    // Merge auth tokens from user config
    let scanOptions = options || {};
    const userConfig = await getUserConfig();
    const tokenKey = provider.id as keyof typeof userConfig.gitTokens;
    if (userConfig.gitTokens?.[tokenKey] && !scanOptions.token) {
      scanOptions = { ...scanOptions, token: userConfig.gitTokens[tokenKey] };
    }

    const result = await provider.scan(url, scanOptions);
    res.json({ ...result, providerId: provider.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to auto-detect and scan URL';
    res.status(500).json({ error: message });
  }
});

// ==================== Scan Endpoints ====================

// POST /api/import/scan/github - Scan GitHub repository
router.post('/scan/github', async (req: Request, res: Response) => {
  try {
    const { url, branch } = req.body;
    if (!url) {
      res.status(400).json({ error: 'GitHub URL is required' });
      return;
    }
    // Read token from user local config
    const userConfig = await getUserConfig();
    const token = userConfig.gitTokens?.github || undefined;
    const result = await scanGitHub(url, branch, token);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to scan GitHub repository';
    res.status(500).json({ error: message });
  }
});

// POST /api/import/scan/gitee - Scan Gitee repository
router.post('/scan/gitee', async (req: Request, res: Response) => {
  try {
    const { url, branch } = req.body;
    if (!url) {
      res.status(400).json({ error: 'Gitee URL is required' });
      return;
    }
    const userConfig = await getUserConfig();
    const token = userConfig.gitTokens?.gitee || undefined;
    const result = await scanGitee(url, branch, token);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to scan Gitee repository';
    res.status(500).json({ error: message });
  }
});

// POST /api/import/scan/gitlab - Scan GitLab repository
router.post('/scan/gitlab', async (req: Request, res: Response) => {
  try {
    const { url, branch } = req.body;
    if (!url) {
      res.status(400).json({ error: 'GitLab URL is required' });
      return;
    }
    const userConfig = await getUserConfig();
    const token = userConfig.gitTokens?.gitlab || undefined;
    const result = await scanGitLab(url, branch, token);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to scan GitLab repository';
    res.status(500).json({ error: message });
  }
});

// POST /api/import/scan/bitbucket - Scan Bitbucket repository
router.post('/scan/bitbucket', async (req: Request, res: Response) => {
  try {
    const { url, branch } = req.body;
    if (!url) {
      res.status(400).json({ error: 'Bitbucket URL is required' });
      return;
    }
    const result = await scanBitbucket(url, branch);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to scan Bitbucket repository';
    res.status(500).json({ error: message });
  }
});

// POST /api/import/scan/clawhub - Scan ClawHub skill
router.post('/scan/clawhub', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) {
      res.status(400).json({ error: 'ClawHub URL is required' });
      return;
    }
    const result = await scanClawHub(url);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to scan ClawHub skill';
    res.status(500).json({ error: message });
  }
});

// POST /api/import/select-path - Open system file picker dialog
router.post('/select-path', async (req: Request, res: Response) => {
  try {
    const { execSync } = await import('child_process');
    const platform = process.platform;
    let selectedPath = '';

    if (platform === 'darwin') {
      // macOS: use osascript to open folder selection dialog
      try {
        selectedPath = execSync(
          `osascript -e 'set theFolder to choose folder with prompt "选择要导入的文件夹"' -e 'POSIX path of theFolder'`,
          { encoding: 'utf-8', timeout: 60000 }
        ).trim();
      } catch {
        // User cancelled the dialog
        res.json({ path: '' });
        return;
      }
    } else if (platform === 'win32') {
      // Windows: use PowerShell folder browser dialog
      try {
        selectedPath = execSync(
          `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = '选择要导入的文件夹'; if ($f.ShowDialog() -eq 'OK') { $f.SelectedPath } else { '' }"`,
          { encoding: 'utf-8', timeout: 60000 }
        ).trim();
      } catch {
        res.json({ path: '' });
        return;
      }
    } else {
      // Linux: try zenity
      try {
        selectedPath = execSync(
          `zenity --file-selection --directory --title="选择要导入的文件夹" 2>/dev/null`,
          { encoding: 'utf-8', timeout: 60000 }
        ).trim();
      } catch {
        res.json({ path: '' });
        return;
      }
    }

    res.json({ path: selectedPath });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to open file picker';
    res.status(500).json({ error: message });
  }
});

// POST /api/import/scan/local - Scan local path
router.post('/scan/local', async (req: Request, res: Response) => {
  try {
    const { path: localPath } = req.body;
    if (!localPath) {
      res.status(400).json({ error: 'Local path is required' });
      return;
    }
    const result = await scanLocal(localPath);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to scan local path';
    res.status(500).json({ error: message });
  }
});

// POST /api/import/scan/clipboard - Parse clipboard content
router.post('/scan/clipboard', async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content) {
      res.status(400).json({ error: 'Clipboard content is required' });
      return;
    }
    const result = await scanClipboard(content);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse clipboard content';
    res.status(500).json({ error: message });
  }
});

// POST /api/import/scan/auto - Auto-detect URL type and scan
router.post('/scan/auto', async (req: Request, res: Response) => {
  try {
    const { url, branch } = req.body;
    if (!url) {
      res.status(400).json({ error: 'URL is required' });
      return;
    }

    const sourceType = detectUrlType(url);
    if (!sourceType) {
      res.status(400).json({ error: 'Unsupported URL format. Supported: GitHub, Gitee, GitLab, Bitbucket, ClawHub' });
      return;
    }

    let result;
    switch (sourceType) {
      case 'github':
        result = await scanGitHub(url, branch);
        break;
      case 'gitee':
        result = await scanGitee(url, branch);
        break;
      case 'gitlab':
        result = await scanGitLab(url, branch);
        break;
      case 'bitbucket':
        result = await scanBitbucket(url, branch);
        break;
      case 'clawhub':
        result = await scanClawHub(url);
        break;
      default:
        res.status(400).json({ error: 'Unsupported source type' });
        return;
    }

    res.json({ ...result, sourceType });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to scan URL';
    res.status(500).json({ error: message });
  }
});

// ==================== Upload Endpoint ====================

// POST /api/import/upload - Upload ZIP/archive file
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const ext = path.extname(req.file.originalname).toLowerCase();

    if (ext === '.zip') {
      const result = await scanZip(req.file.path);
      res.json({
        tempPath: req.file.path,
        tempDir: result.tempDir,
        skills: result.skills,
      });
    } else {
      // For RAR/7Z, return error for now (will be implemented in milestone 3)
      res.status(400).json({ error: `${ext} format is not yet supported. Please use ZIP format.` });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process uploaded file';
    res.status(500).json({ error: message });
  }
});

// ==================== Execute Import ====================

// POST /api/import/execute - Execute import with selected skills
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { source, skills, options, sourceUrl } = req.body as {
      source: string;
      skills: ScannedSkill[];
      options: ImportOptions;
      sourceUrl?: string;
    };

    if (!skills || !Array.isArray(skills) || skills.length === 0) {
      res.status(400).json({ error: 'Skills array is required' });
      return;
    }

    if (!options) {
      res.status(400).json({ error: 'Import options are required' });
      return;
    }

    const result = await executeImport(skills, options, source as any, sourceUrl);

    // Record import history (with version if available)
    try {
      const { addHistory } = await import('../services/importHistoryService.js');
      await addHistory({
        id: '',
        source: source as any,
        sourceUrl,
        timestamp: new Date().toISOString(),
        result,
        version: req.body.version || undefined,
      });
    } catch { /* ignore history errors */ }

    res.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to execute import';
    res.status(500).json({ error: message });
  }
});

// ==================== Batch Import ====================

// POST /api/import/batch - Batch import from multiple URLs
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { urls, options } = req.body;
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      res.status(400).json({ error: 'URLs array is required' });
      return;
    }
    if (!options) {
      res.status(400).json({ error: 'Import options are required' });
      return;
    }

    const result = await importBatch(urls, options);

    // Record history
    try {
      const { addHistory } = await import('../services/importHistoryService.js');
      await addHistory({
        id: '',
        source: 'batch',
        sourceUrl: urls.join('\n'),
        timestamp: new Date().toISOString(),
        result,
      });
    } catch { /* ignore */ }

    res.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to batch import';
    res.status(500).json({ error: message });
  }
});

// ==================== Conflict Check ====================

// POST /api/import/check-conflict - Check for naming conflicts
router.post('/check-conflict', async (req: Request, res: Response) => {
  try {
    const { skillNames, targetSourceDirId } = req.body;
    if (!skillNames || !Array.isArray(skillNames)) {
      res.status(400).json({ error: 'skillNames array is required' });
      return;
    }
    const conflicts = await checkConflicts(skillNames, targetSourceDirId);
    res.json({ conflicts });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to check conflicts';
    res.status(500).json({ error: message });
  }
});

// ==================== History Endpoints ====================

// GET /api/import/history - Get import history
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { getHistory } = await import('../services/importHistoryService.js');
    const source = req.query.source as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const history = await getHistory(source, limit);
    res.json({ history });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get import history';
    res.status(500).json({ error: message });
  }
});

// DELETE /api/import/history/:id - Delete history item
router.delete('/history/:id', async (req: Request, res: Response) => {
  try {
    const { deleteHistory } = await import('../services/importHistoryService.js');
    await deleteHistory(req.params.id as string);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete history item';
    res.status(500).json({ error: message });
  }
});

// DELETE /api/import/history - Clear all history
router.delete('/history', async (_req: Request, res: Response) => {
  try {
    const { clearHistory } = await import('../services/importHistoryService.js');
    await clearHistory();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear history' });
  }
});

// ==================== Subscription Endpoints ====================

// GET /api/import/subscriptions - Get all subscriptions
router.get('/subscriptions', async (_req: Request, res: Response) => {
  try {
    const { getSubscriptions } = await import('../services/subscriptionService.js');
    const subscriptions = await getSubscriptions();
    res.json({ subscriptions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get subscriptions' });
  }
});

// POST /api/import/subscribe - Subscribe to a skill source
router.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const { subscribe } = await import('../services/subscriptionService.js');
    const { skillPath, skillName, source, sourceUrl, branch, version } = req.body;
    if (!skillPath || !source || !sourceUrl) {
      res.status(400).json({ error: 'skillPath, source, and sourceUrl are required' });
      return;
    }
    const subscription = await subscribe(skillPath, skillName, source, sourceUrl, branch, version);
    // Persist subscribed flag in import history so it survives page refresh
    try {
      const { markHistorySubscribed } = await import('../services/importHistoryService.js');
      await markHistorySubscribed(sourceUrl);
    } catch { /* ignore history update errors */ }
    res.json({ subscription });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to subscribe';
    res.status(500).json({ error: message });
  }
});

// DELETE /api/import/subscribe - Unsubscribe
router.delete('/subscribe', async (req: Request, res: Response) => {
  try {
    const { unsubscribe } = await import('../services/subscriptionService.js');
    const { skillPath } = req.body;
    if (!skillPath) {
      res.status(400).json({ error: 'skillPath is required' });
      return;
    }
    await unsubscribe(skillPath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

// POST /api/import/check-update - Check for updates on a subscribed skill
router.post('/check-update', async (req: Request, res: Response) => {
  try {
    const { checkUpdate } = await import('../services/subscriptionService.js');
    const { skillPath } = req.body;
    if (!skillPath) {
      res.status(400).json({ error: 'skillPath is required' });
      return;
    }
    const result = await checkUpdate(skillPath);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to check update';
    res.status(500).json({ error: message });
  }
});

// POST /api/import/apply-update - Apply update to a subscribed skill
router.post('/apply-update', async (req: Request, res: Response) => {
  try {
    const { applyUpdate } = await import('../services/subscriptionService.js');
    const { skillPath } = req.body;
    if (!skillPath) {
      res.status(400).json({ error: 'skillPath is required' });
      return;
    }
    const result = await applyUpdate(skillPath);
    res.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to apply update';
    res.status(500).json({ error: message });
  }
});

// POST /api/import/check-all-updates - Batch check all subscriptions for updates
router.post('/check-all-updates', async (req: Request, res: Response) => {
  try {
    const { checkAllUpdates } = await import('../services/subscriptionService.js');
    const result = await checkAllUpdates();
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to check updates';
    res.status(500).json({ error: message });
  }
});

// PUT /api/import/auto-update - Configure auto-update
router.put('/auto-update', async (req: Request, res: Response) => {
  try {
    const { setAutoUpdateConfig } = await import('../services/subscriptionService.js');
    const { enabled, interval } = req.body;
    await setAutoUpdateConfig(enabled, interval);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to configure auto-update' });
  }
});

// ==================== CSV/JSON Import/Export ====================

// POST /api/import/import/csv - Import from CSV content
router.post('/import/csv', async (req: Request, res: Response) => {
  try {
    const { content, options } = req.body;
    if (!content) {
      res.status(400).json({ error: 'CSV content is required' });
      return;
    }
    const result = await importFromCSV(content, options);
    res.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to import from CSV';
    res.status(500).json({ error: message });
  }
});

// POST /api/import/import/json - Import from JSON content
router.post('/import/json', async (req: Request, res: Response) => {
  try {
    const { content, options } = req.body;
    if (!content) {
      res.status(400).json({ error: 'JSON content is required' });
      return;
    }
    const result = await importFromJSON(content, options);
    res.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to import from JSON';
    res.status(500).json({ error: message });
  }
});

// GET /api/import/export/csv - Export history as CSV
router.get('/export/csv', async (_req: Request, res: Response) => {
  try {
    const csv = await exportToCSV();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=import-history.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

// GET /api/import/export/json - Export history as JSON
router.get('/export/json', async (_req: Request, res: Response) => {
  try {
    const json = await exportToJSON();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=import-history.json');
    res.send(json);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export JSON' });
  }
});

// ==================== Import Stats ====================

// GET /api/import/stats - Get import statistics
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const { getImportStats } = await import('../services/importAnalyticsService.js');
    const stats = await getImportStats();
    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get import stats' });
  }
});

// ==================== Extension Plugins ====================

// Configure multer for extension plugin uploads (only .js files)
const extensionUpload = multer({
  dest: path.join(os.tmpdir(), 'skills-manager-ext-uploads'),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.js' || ext === '.mjs') {
      cb(null, true);
    } else {
      cb(new Error(`仅支持 .js 文件，当前文件类型: ${ext}`));
    }
  },
});

// GET /api/import/extensions - List installed extension plugins
router.get('/extensions', async (_req: Request, res: Response) => {
  try {
    const extDir = path.join(os.homedir(), '.skills-manager', 'extensions');
    await fs.ensureDir(extDir);
    const files = await fs.readdir(extDir);
    const extensions = files
      .filter(f => f.endsWith('.js') || f.endsWith('.mjs'))
      .map(f => ({ name: f, path: path.join(extDir, f) }));
    res.json({ extensions, directory: extDir });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list extensions' });
  }
});

// POST /api/import/extensions/upload - Upload an extension plugin (.js file)
router.post('/extensions/upload', extensionUpload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: '未上传文件' });
      return;
    }

    const extDir = path.join(os.homedir(), '.skills-manager', 'extensions');
    await fs.ensureDir(extDir);

    const targetPath = path.join(extDir, req.file.originalname);

    // Check if file already exists
    const exists = await fs.pathExists(targetPath);

    // Copy uploaded file to extensions directory
    await fs.copy(req.file.path, targetPath, { overwrite: true });

    // Clean up temp file
    await fs.remove(req.file.path).catch(() => {});

    res.json({
      success: true,
      name: req.file.originalname,
      path: targetPath,
      replaced: exists,
      message: exists
        ? `扩展插件 ${req.file.originalname} 已更新，重启后生效`
        : `扩展插件 ${req.file.originalname} 已安装，重启后生效`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload extension';
    res.status(500).json({ error: message });
  }
});

// DELETE /api/import/extensions/:name - Remove an extension plugin
router.delete('/extensions/:name', async (req: Request, res: Response) => {
  try {
    const extDir = path.join(os.homedir(), '.skills-manager', 'extensions');
    const filePath = path.join(extDir, req.params.name as string);

    if (!await fs.pathExists(filePath)) {
      res.status(404).json({ error: '扩展插件不存在' });
      return;
    }

    await fs.remove(filePath);
    res.json({ success: true, message: `扩展插件 ${req.params.name} 已删除，重启后生效` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete extension' });
  }
});

// ==================== Cleanup ====================

// POST /api/import/cleanup - Clean up temp files
router.post('/cleanup', async (_req: Request, res: Response) => {
  try {
    await cleanupTempFiles();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cleanup temp files' });
  }
});

export default router;