import path from 'path';
import fs from 'fs-extra';
export function validatePath(inputPath) {
    if (!inputPath || typeof inputPath !== 'string')
        return false;
    const resolved = path.resolve(inputPath);
    // Prevent path traversal
    if (resolved.includes('..'))
        return false;
    return true;
}
export async function validatePathExists(inputPath) {
    if (!validatePath(inputPath))
        return false;
    return fs.pathExists(inputPath);
}
export function validateFileName(name) {
    if (!name || typeof name !== 'string')
        return false;
    // Disallow special characters in file names
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
    return !invalidChars.test(name);
}
export function sanitizePath(inputPath) {
    return path.normalize(inputPath).replace(/\.\./g, '');
}
export function isMarkdownFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ['.md', '.markdown', '.mdown', '.mkd'].includes(ext);
}
export function validateToolType(type) {
    const validTypes = ['claude', 'cursor', 'codebuddy', 'copilot', 'custom'];
    return validTypes.includes(type);
}
