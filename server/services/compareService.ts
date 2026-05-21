import fs from 'fs-extra';
import path from 'path';
import { evaluateSkill } from './rubricService.js';
import { getDefaultModelConfig } from './configService.js';
import type { RubricReport, RubricDimensionReport } from './rubricService.js';

// ==================== Types ====================

export interface CompareRequest {
  skillPathA: string;
  skillPathB: string;
  templateId?: string;
  includeAI?: boolean;
}

export interface DimensionComparison {
  dimensionId: string;
  label: string;
  weight: number;
  scoreA: number;
  scoreB: number;
  diff: number;  // scoreA - scoreB
  winner: 'A' | 'B' | 'tie';
}

export interface ContentDiffLine {
  type: 'same' | 'added' | 'removed';
  content: string;
}

export interface CompareReport {
  skillA: { name: string; path: string };
  skillB: { name: string; path: string };
  reportA: RubricReport;
  reportB: RubricReport;
  dimensions: DimensionComparison[];
  overallDiff: number;  // reportA.overallScore - reportB.overallScore
  winner: 'A' | 'B' | 'tie';
  contentDiff: ContentDiffLine[];
  comparedAt: string;
}

// ==================== Content Diff ====================

// LCS DP is O(m·n) memory. 5000 lines × 5000 lines × 4-byte int ≈ 100 MB.
// Anything beyond this is more likely a binary blob mistakenly fed in than a
// real SKILL.md.
const MAX_DIFF_LINES = 5000;

/**
 * Simple line-based diff between two strings.
 * Uses a basic LCS approach suitable for SKILL.md comparison.
 *
 * Throws if either side exceeds MAX_DIFF_LINES — bounded to prevent
 * O(m·n) memory blow-up on pathological inputs.
 */
function computeLineDiff(textA: string, textB: string): ContentDiffLine[] {
  const linesA = textA.split('\n');
  const linesB = textB.split('\n');

  if (linesA.length > MAX_DIFF_LINES || linesB.length > MAX_DIFF_LINES) {
    throw new Error(
      `Skill content too large to diff (${linesA.length} vs ${linesB.length} lines, limit ${MAX_DIFF_LINES}). Trim or split the SKILL.md before comparing.`,
    );
  }

  // Build LCS table
  const m = linesA.length;
  const n = linesB.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (linesA[i - 1] === linesB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff
  const result: ContentDiffLine[] = [];
  let i = m;
  let j = n;

  const stack: ContentDiffLine[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      stack.push({ type: 'same', content: linesA[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: 'added', content: linesB[j - 1] });
      j--;
    } else {
      stack.push({ type: 'removed', content: linesA[i - 1] });
      i--;
    }
  }

  // Reverse since we built from bottom-up
  for (let k = stack.length - 1; k >= 0; k--) {
    result.push(stack[k]);
  }

  return result;
}

// ==================== Core Compare ====================

/**
 * Compare two Skills using the same Rubric template.
 * Returns a CompareReport with side-by-side evaluation results and content diff.
 */
export async function compareSkills(request: CompareRequest): Promise<CompareReport> {
  const { skillPathA, skillPathB, templateId, includeAI } = request;

  // Validate paths
  if (!await fs.pathExists(skillPathA)) {
    throw new Error(`Skill A directory not found: ${skillPathA}`);
  }
  if (!await fs.pathExists(skillPathB)) {
    throw new Error(`Skill B directory not found: ${skillPathB}`);
  }

  const nameA = path.basename(skillPathA);
  const nameB = path.basename(skillPathB);

  // AI credentials are read server-side, never from the request body.
  const aiModelConfig = includeAI ? (await getDefaultModelConfig()) ?? undefined : undefined;

  const evalOptions = { templateId: templateId || undefined, aiModelConfig };

  // Evaluate both skills in parallel
  const [reportA, reportB] = await Promise.all([
    evaluateSkill(nameA, skillPathA, evalOptions),
    evaluateSkill(nameB, skillPathB, evalOptions),
  ]);

  // Build dimension comparison
  const dimensions: DimensionComparison[] = reportA.dimensions.map((dimA) => {
    const dimB = reportB.dimensions.find(d => d.dimensionId === dimA.dimensionId);
    const scoreB = dimB?.score ?? 0;
    const diff = Math.round((dimA.score - scoreB) * 100) / 100;
    return {
      dimensionId: dimA.dimensionId,
      label: dimA.label,
      weight: dimA.weight,
      scoreA: dimA.score,
      scoreB,
      diff,
      winner: diff > 0 ? 'A' : diff < 0 ? 'B' : 'tie',
    };
  });

  const overallDiff = Math.round((reportA.overallScore - reportB.overallScore) * 100) / 100;

  // Content diff of SKILL.md. We tolerate "file unreadable" errors silently
  // (one or both skills may not have a SKILL.md) but propagate the LCS size
  // bound — a too-large diff is a load-bearing user-facing error, not a
  // best-effort signal.
  let contentDiff: ContentDiffLine[] = [];
  let contentA: string | null = null;
  let contentB: string | null = null;
  try {
    contentA = await fs.readFile(path.join(skillPathA, 'SKILL.md'), 'utf-8');
  } catch {
    contentA = null;
  }
  try {
    contentB = await fs.readFile(path.join(skillPathB, 'SKILL.md'), 'utf-8');
  } catch {
    contentB = null;
  }
  if (contentA !== null && contentB !== null) {
    contentDiff = computeLineDiff(contentA, contentB);
  }

  return {
    skillA: { name: nameA, path: skillPathA },
    skillB: { name: nameB, path: skillPathB },
    reportA,
    reportB,
    dimensions,
    overallDiff,
    winner: overallDiff > 0 ? 'A' : overallDiff < 0 ? 'B' : 'tie',
    contentDiff,
    comparedAt: new Date().toISOString(),
  };
}
