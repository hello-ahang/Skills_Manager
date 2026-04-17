import fs from 'fs-extra';
import path from 'path';
import type { ToolType, DiffHunk } from '../../src/types/index.js';

// ==================== Format Converters ====================

function cursorToClaude(content: string): string {
  // .cursorrules is typically plain text
  // Claude skills are Markdown
  return `# Cursor Rules Migration\n\n${content}`;
}

function claudeToCursor(content: string): string {
  // Strip markdown headers for cursor rules format
  return content
    .replace(/^#+ /gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .trim();
}

function codebuddyToClaude(content: string): string {
  return `# CodeBuddy Rules Migration\n\n${content}`;
}

function claudeToCodebuddy(content: string): string {
  return content;
}

function genericConvert(content: string, from: ToolType, to: ToolType): string {
  return `# Converted from ${from} to ${to}\n\n${content}`;
}

const converters: Record<string, (content: string) => string> = {
  'cursor->claude': cursorToClaude,
  'claude->cursor': claudeToCursor,
  'codebuddy->claude': codebuddyToClaude,
  'claude->codebuddy': claudeToCodebuddy,
};

export function convertContent(content: string, from: ToolType, to: ToolType): string {
  const key = `${from}->${to}`;
  const converter = converters[key];
  if (converter) {
    return converter(content);
  }
  return genericConvert(content, from, to);
}

export async function convertFiles(
  files: string[],
  from: ToolType,
  to: ToolType,
  outputDir: string
): Promise<{ source: string; output: string; success: boolean; error?: string }[]> {
  await fs.ensureDir(outputDir);
  const results: { source: string; output: string; success: boolean; error?: string }[] = [];

  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const converted = convertContent(content, from, to);
      const outputPath = path.join(outputDir, path.basename(file));
      await fs.writeFile(outputPath, converted, 'utf-8');
      results.push({ source: file, output: outputPath, success: true });
    } catch (error) {
      results.push({
        source: file,
        output: '',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

// ==================== Markdown Validation ====================

export function validateMarkdown(content: string): {
  valid: boolean;
  errors: { line: number; message: string }[];
  warnings: { line: number; message: string }[];
} {
  const errors: { line: number; message: string }[] = [];
  const warnings: { line: number; message: string }[] = [];
  const lines = content.split('\n');

  let inCodeBlock = false;

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // Track code blocks
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      return;
    }

    if (inCodeBlock) return;

    // Check for unclosed inline code
    const backtickCount = (line.match(/`/g) || []).length;
    if (backtickCount % 2 !== 0) {
      warnings.push({ line: lineNum, message: 'Possible unclosed inline code block' });
    }

    // Check for heading without space after #
    if (/^#{1,6}[^# ]/.test(line)) {
      errors.push({ line: lineNum, message: 'Missing space after heading marker (#)' });
    }

    // Check for trailing whitespace
    if (line.endsWith(' ') && !line.endsWith('  ')) {
      warnings.push({ line: lineNum, message: 'Trailing whitespace detected' });
    }

    // Check for very long lines
    if (line.length > 300) {
      warnings.push({ line: lineNum, message: `Line is very long (${line.length} chars)` });
    }
  });

  // Check if code block is still open at end
  if (inCodeBlock) {
    errors.push({ line: lines.length, message: 'Unclosed code block' });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ==================== Diff ====================

export function computeDiff(content1: string, content2: string): DiffHunk[] {
  const lines1 = content1.split('\n');
  const lines2 = content2.split('\n');
  const hunks: DiffHunk[] = [];

  // Simple line-by-line diff (LCS-based)
  const maxLen = Math.max(lines1.length, lines2.length);
  let currentHunk: DiffHunk | null = null;

  let i = 0, j = 0;

  while (i < lines1.length || j < lines2.length) {
    if (i < lines1.length && j < lines2.length && lines1[i] === lines2[j]) {
      // Lines match
      if (currentHunk) {
        currentHunk.lines.push({ type: 'normal', content: lines1[i] });
      }
      i++;
      j++;
    } else {
      // Lines differ
      if (!currentHunk) {
        currentHunk = {
          oldStart: i + 1,
          newStart: j + 1,
          lines: [],
        };
        hunks.push(currentHunk);
      }

      if (i < lines1.length && (j >= lines2.length || !lines2.slice(j).includes(lines1[i]))) {
        currentHunk.lines.push({ type: 'remove', content: lines1[i] });
        i++;
      } else if (j < lines2.length) {
        currentHunk.lines.push({ type: 'add', content: lines2[j] });
        j++;
      }
    }

    // Reset hunk after context
    if (currentHunk && currentHunk.lines.length > 0) {
      const lastLine = currentHunk.lines[currentHunk.lines.length - 1];
      if (lastLine.type === 'normal') {
        const normalCount = currentHunk.lines.filter(l => l.type === 'normal').length;
        if (normalCount >= 3) {
          currentHunk = null;
        }
      }
    }
  }

  return hunks;
}
