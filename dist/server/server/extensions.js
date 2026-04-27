import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { registerImportProvider } from './services/importService.js';
import { registerPublishTarget } from './services/publishService.js';
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
export async function loadExtensions() {
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
        if (!await fs.pathExists(dir))
            continue;
        let files;
        try {
            files = await fs.readdir(dir);
        }
        catch {
            continue;
        }
        for (const file of files) {
            if (!file.endsWith('.js') && !file.endsWith('.mjs'))
                continue;
            const filePath = path.join(dir, file);
            try {
                const ext = await import(filePath);
                if (typeof ext.setup === 'function') {
                    await ext.setup(context);
                    loadedCount++;
                    console.log(`[Extensions] Loaded: ${file}`);
                }
                else if (typeof ext.default?.setup === 'function') {
                    await ext.default.setup(context);
                    loadedCount++;
                    console.log(`[Extensions] Loaded: ${file}`);
                }
                else {
                    console.warn(`[Extensions] Skipped ${file}: no setup() function exported`);
                }
            }
            catch (err) {
                console.error(`[Extensions] Failed to load ${file}:`, err);
            }
        }
    }
    if (loadedCount > 0) {
        console.log(`[Extensions] ${loadedCount} extension(s) loaded successfully`);
    }
}
