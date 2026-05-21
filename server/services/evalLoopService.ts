import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { evaluateSkill } from './rubricService.js';
import { createVersion } from './versionService.js';
import type {
  RubricReport as ServerRubricReport,
  RubricDimensionReport as ServerRubricDimensionReport,
  RubricItemReport as ServerRubricItemReport,
  RubricDimensionId as ServerRubricDimensionId,
} from './rubricService.js';
import type {
  EvalLoopConfig,
  EvalLoopRound,
  EvalLoopResult,
  EvalLoopStatus,
  RubricReport as SharedRubricReport,
  RubricDimensionReport as SharedRubricDimensionReport,
  RubricItemReport as SharedRubricItemReport,
  RubricDimensionId as SharedRubricDimensionId,
} from '../../src/types/index.js';

const DIMENSION_ID_MAP: Record<ServerRubricDimensionId, SharedRubricDimensionId> = {
  L1: 'L1_structure',
  L2: 'L2_description',
  L3: 'L3_depth',
  L4: 'L4_safety',
};

// Server's RubricReport carries internal scoring fields (label, weight) that
// the wire-format type omits. Project to the shared shape at the boundary.
function toSharedReport(serverReport: ServerRubricReport): SharedRubricReport {
  return {
    skillName: serverReport.skillName,
    skillPath: serverReport.skillPath,
    overallScore: serverReport.overallScore,
    grade: serverReport.grade,
    dimensions: serverReport.dimensions.map(toSharedDimension),
    evaluatedAt: serverReport.evaluatedAt,
    templateId: serverReport.templateId,
  };
}

function toSharedDimension(d: ServerRubricDimensionReport): SharedRubricDimensionReport {
  return {
    dimensionId: DIMENSION_ID_MAP[d.dimensionId],
    dimensionName: d.label,
    score: d.score,
    maxScore: 100,
    items: d.items.map(toSharedItem),
  };
}

function toSharedItem(i: ServerRubricItemReport): SharedRubricItemReport {
  return {
    itemId: i.itemId,
    result: i.result,
    score: i.score,
    detail: i.detail || undefined,
    suggestion: i.suggestion,
  };
}

// ==================== Types ====================

interface AIModelConfig {
  baseUrl: string;
  apiKey: string;
  modelName: string;
}

// ==================== Constants ====================

const HISTORY_PATH = path.join(os.homedir(), '.skills-manager', 'eval-loop-history.json');

// ==================== Active Loops (in-memory) ====================

const activeLoops = new Map<string, { result: EvalLoopResult; abortController: AbortController }>();

export function getActiveLoop(loopId: string): EvalLoopResult | undefined {
  return activeLoops.get(loopId)?.result;
}

export function getActiveLoops(): EvalLoopResult[] {
  return Array.from(activeLoops.values()).map(entry => entry.result);
}

// ==================== Stop Loop ====================

export function stopEvalLoop(loopId: string): boolean {
  const entry = activeLoops.get(loopId);
  if (!entry) return false;
  entry.abortController.abort();
  return true;
}

// ==================== History ====================

export async function loadEvalHistory(): Promise<EvalLoopResult[]> {
  if (await fs.pathExists(HISTORY_PATH)) {
    try {
      return await fs.readJson(HISTORY_PATH);
    } catch {
      return [];
    }
  }
  return [];
}

export async function saveEvalHistory(result: EvalLoopResult): Promise<void> {
  await fs.ensureDir(path.dirname(HISTORY_PATH));
  const history = await loadEvalHistory();
  const existingIndex = history.findIndex(item => item.id === result.id);
  if (existingIndex >= 0) {
    history[existingIndex] = result;
  } else {
    history.push(result);
  }
  await fs.writeJson(HISTORY_PATH, history, { spaces: 2 });
}

export async function getEvalHistory(skillPath?: string): Promise<EvalLoopResult[]> {
  const history = await loadEvalHistory();
  if (skillPath) {
    return history.filter(item => item.skillPath === skillPath);
  }
  return history;
}

// ==================== AI Improve ====================

export async function improveSkill(
  skillDir: string,
  report: ServerRubricReport,
  aiModelConfig: AIModelConfig,
): Promise<string[]> {
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  const originalContent = await fs.readFile(skillMdPath, 'utf-8');

  // Extract all failed check items with their details and suggestions
  const failedItems: { detail: string; suggestion: string }[] = [];
  for (const dimension of report.dimensions) {
    for (const item of dimension.items) {
      if (item.result === 'fail') {
        failedItems.push({
          detail: item.detail,
          suggestion: item.suggestion ?? '',
        });
      }
    }
  }

  if (failedItems.length === 0) {
    return ['No failed items to improve'];
  }

  const improvementList = failedItems
    .map((item, index) => `${index + 1}. Problem: ${item.detail}\n   Suggestion: ${item.suggestion}`)
    .join('\n');

  const prompt = `You are a skill document improvement assistant. Below is the current SKILL.md content and a list of issues found during evaluation. Please rewrite the SKILL.md to address all the issues while preserving the existing good content.

## Current SKILL.md
\`\`\`
${originalContent}
\`\`\`

## Issues to Fix
${improvementList}

## Instructions
- Fix all the listed issues
- Keep the existing structure and good content
- Output ONLY the improved SKILL.md content, no explanations or code fences
- The output must be a valid SKILL.md file that starts with a heading or frontmatter`;

  try {
    const response = await fetch(`${aiModelConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiModelConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: aiModelConfig.modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API returned status ${response.status}`);
    }

    const data = await response.json() as {
      choices: { message: { content: string } }[];
    };
    const improvedContent = data.choices?.[0]?.message?.content?.trim();

    // Validate: must be non-empty and reasonably long (at least 20% of original)
    if (!improvedContent || improvedContent.length < originalContent.length * 0.2) {
      return ['AI returned invalid content, skipping write'];
    }

    // Validate: should look like a SKILL.md (starts with heading or frontmatter)
    if (!improvedContent.startsWith('#') && !improvedContent.startsWith('---')) {
      return ['AI returned content that does not look like a SKILL.md, skipping write'];
    }

    await fs.writeFile(skillMdPath, improvedContent, 'utf-8');

    const improvements = failedItems.map(item =>
      item.suggestion ? `Fixed: ${item.suggestion}` : `Addressed: ${item.detail}`,
    );
    return improvements;
  } catch (error) {
    // On any AI failure, keep original file untouched
    return [`AI improvement failed: ${error instanceof Error ? error.message : 'Unknown error'}`];
  }
}

// ==================== Core Loop Engine ====================

export async function startEvalLoop(
  config: EvalLoopConfig,
  aiModelConfig: AIModelConfig,
  onProgress?: (round: EvalLoopRound, loopId: string) => void,
): Promise<EvalLoopResult> {
  const loopId = uuidv4();
  const abortController = new AbortController();
  const skillName = path.basename(config.skillPath);

  const result: EvalLoopResult = {
    id: loopId,
    skillName,
    skillPath: config.skillPath,
    config,
    status: 'running',
    exitReason: 'max_rounds',
    rounds: [],
    startedAt: new Date().toISOString(),
    initialScore: 0,
    finalScore: 0,
  };

  activeLoops.set(loopId, { result, abortController });

  try {
    let roundNumber = 0;

    while (roundNumber < config.maxRounds) {
      // Check abort before starting a new round
      if (abortController.signal.aborted) {
        result.exitReason = 'user_stopped';
        result.status = 'stopped';
        break;
      }

      const roundStart = Date.now();
      roundNumber++;

      // Step 1: Evaluate current state
      let report: ServerRubricReport;
      try {
        report = await evaluateSkill(skillName, config.skillPath, {
          templateId: config.templateId,
          aiModelConfig,
        });
      } catch (error) {
        // Single round eval failure — record and continue to next check
        result.exitReason = 'error';
        result.status = 'failed';
        break;
      }

      const currentScore = report.overallScore;

      // Record initial score on first round
      if (roundNumber === 1) {
        result.initialScore = currentScore;
      }
      result.finalScore = currentScore;

      // Step 2: Check exit conditions — target reached
      if (currentScore >= config.targetScore) {
        const round: EvalLoopRound = {
          round: roundNumber,
          score: currentScore,
          grade: report.grade,
          report: toSharedReport(report),
          improvements: [],
          duration: Date.now() - roundStart,
        };
        result.rounds.push(round);
        onProgress?.(round, loopId);
        result.exitReason = 'target_reached';
        result.status = 'completed';
        break;
      }

      // Step 2b: Check low improvement (need at least 2 rounds)
      if (result.rounds.length >= 1) {
        const previousScore = result.rounds[result.rounds.length - 1].score;
        const improvement = currentScore - previousScore;
        if (improvement < config.minImprovement) {
          const round: EvalLoopRound = {
            round: roundNumber,
            score: currentScore,
            grade: report.grade,
            report: toSharedReport(report),
            improvements: [],
            duration: Date.now() - roundStart,
          };
          result.rounds.push(round);
          onProgress?.(round, loopId);
          result.exitReason = 'low_improvement';
          result.status = 'completed';
          break;
        }
      }

      // Step 2c: Check max rounds (last round — evaluate only, no improve)
      if (roundNumber >= config.maxRounds) {
        const round: EvalLoopRound = {
          round: roundNumber,
          score: currentScore,
          grade: report.grade,
          report: toSharedReport(report),
          improvements: [],
          duration: Date.now() - roundStart,
        };
        result.rounds.push(round);
        onProgress?.(round, loopId);
        result.exitReason = 'max_rounds';
        result.status = 'completed';
        break;
      }

      // Check abort again before AI improvement
      if (abortController.signal.aborted) {
        const round: EvalLoopRound = {
          round: roundNumber,
          score: currentScore,
          grade: report.grade,
          report: toSharedReport(report),
          improvements: [],
          duration: Date.now() - roundStart,
        };
        result.rounds.push(round);
        onProgress?.(round, loopId);
        result.exitReason = 'user_stopped';
        result.status = 'stopped';
        break;
      }

      // Step 3: AI improvement
      let improvements: string[];
      try {
        improvements = await improveSkill(config.skillPath, report, aiModelConfig);
      } catch (error) {
        improvements = [`Improvement failed: ${error instanceof Error ? error.message : 'Unknown error'}`];
      }

      // Step 4: Create version snapshot
      let versionId: string | undefined;
      try {
        const versionLabel = `Eval Loop round ${roundNumber} (score: ${currentScore})`;
        const versionRecord = await createVersion(config.skillPath, `eval-r${roundNumber}`, versionLabel);
        versionId = versionRecord.id;
      } catch {
        // Version creation failure is non-fatal
      }

      // Step 5: Record round
      const round: EvalLoopRound = {
        round: roundNumber,
        score: currentScore,
        grade: report.grade,
        report: toSharedReport(report),
        improvements,
        versionId,
        duration: Date.now() - roundStart,
      };
      result.rounds.push(round);
      onProgress?.(round, loopId);
    }

    // Finalize status if not already set by exit conditions
    if (result.status === 'running') {
      result.status = 'completed';
    }
  } catch (error) {
    result.status = 'failed';
    result.exitReason = 'error';
  }

  result.completedAt = new Date().toISOString();

  // Persist to history
  try {
    await saveEvalHistory(result);
  } catch {
    // History persistence failure is non-fatal
  }

  // Remove from active loops
  activeLoops.delete(loopId);

  return result;
}
