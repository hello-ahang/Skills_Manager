import fs from 'fs-extra';

/**
 * Check if a project directory exists and is accessible.
 */
export async function checkProjectExists(projectPath: string): Promise<boolean> {
  return fs.pathExists(projectPath);
}
