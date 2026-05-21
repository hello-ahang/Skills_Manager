import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { registerImportProvider } from './services/importService.js';
import { registerPublishTarget } from './services/publishService.js';
import { log } from './utils/logger.js';

/**
 * Load extension files that register additional Import Providers and Publish Targets.
 *
 * Extension file lookup order:
 * 1. ~/.skills-manager/extensions/   (user-level extensions)
 * 2. {project root}/extensions/      (project-level extensions)
 *
 * Each extension is a .js or .mjs file that exports a setup(context) function:
 *
 *   export function setup(context) {
 *     context.registerImportProvider({ ... });
 *     context.registerPublishTarget({ ... });
 *   }
 */
export async function loadExtensions(): Promise<void> {
  const extensionDirs = [
    path.join(os.homedir(), '.skills-manager', 'extensions'),
    path.join(process.cwd(), 'extensions'),
  ];

  const context = {
    registerImportProvider,
    registerPublishTarget,
  };

  let loadedCount = 0;

  for (const dir of extensionDirs) {
    if (!await fs.pathExists(dir)) continue;

    let files: string[];
    try {
      files = await fs.readdir(dir);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith('.js') && !file.endsWith('.mjs')) continue;

      const filePath = path.join(dir, file);
      try {
        const ext = await import(filePath);
        if (typeof ext.setup === 'function') {
          await ext.setup(context);
          loadedCount++;
          log.info(`[Extensions] Loaded: ${file}`);
        } else if (typeof ext.default?.setup === 'function') {
          await ext.default.setup(context);
          loadedCount++;
          log.info(`[Extensions] Loaded: ${file}`);
        } else {
          log.warn(`[Extensions] Skipped ${file}: no setup() function exported`);
        }
      } catch (err) {
        log.error({ err }, `[Extensions] Failed to load ${file}`);
      }
    }
  }

  if (loadedCount > 0) {
    log.info(`[Extensions] ${loadedCount} extension(s) loaded successfully`);
  }
}
