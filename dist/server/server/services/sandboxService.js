import fs from 'fs-extra';
import path from 'path';
import os from 'os';
// ==================== History persistence ====================
const HISTORY_DIR = path.join(os.homedir(), '.skills-manager');
const HISTORY_FILE = path.join(HISTORY_DIR, 'sandbox-history.json');
export async function loadSandboxHistory() {
    try {
        if (!await fs.pathExists(HISTORY_FILE))
            return [];
        const raw = await fs.readFile(HISTORY_FILE, 'utf-8');
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    }
    catch {
        return [];
    }
}
export async function saveSandboxHistory(entry) {
    await fs.ensureDir(HISTORY_DIR);
    const existing = await loadSandboxHistory();
    // 最多保留 50 条历史
    const next = [entry, ...existing].slice(0, 50);
    await fs.writeFile(HISTORY_FILE, JSON.stringify(next, null, 2), 'utf-8');
}
export async function clearSandboxHistory() {
    if (await fs.pathExists(HISTORY_FILE)) {
        await fs.remove(HISTORY_FILE);
    }
}
// ==================== AI helpers ====================
async function callLLM(modelConfig, messages, maxTokens = 2048, timeoutMs = 60000) {
    const response = await fetch(`${modelConfig.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${modelConfig.apiKey}`,
        },
        body: JSON.stringify({
            model: modelConfig.modelName,
            messages,
            max_tokens: maxTokens,
        }),
        signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown error');
        throw new Error(`AI API ${response.status}: ${errText}`);
    }
    const data = await response.json();
    return data?.choices?.[0]?.message?.content || '';
}
function stripJsonFence(content) {
    return content.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
}
// ==================== Core: Trigger test (复用 radar search 逻辑) ====================
/**
 * 调用 AI 模拟"用户在 IDE 里描述场景，AI 决定加载哪个 Skill"的过程，
 * 返回 AI 推荐的 Top N Skills 及其分数。
 */
async function aiPickTopSkills(scenario, skills, modelConfig, topN = 3) {
    const skillsList = skills
        .map(s => `- ${s.name}: ${s.description || s.contentSummary || '无描述'}`)
        .join('\n');
    const messages = [
        {
            role: 'system',
            content: `你正在模拟 AI Coding Agent 的 Skill 触发决策。给定一个用户场景，从以下 Skills 中选出最可能被触发的 Top ${topN} 个。

Skills 列表：
${skillsList}

返回 JSON 数组（不要 markdown 代码块）：
[
  { "name": "skill-name", "score": 0.95 }
]
score 为 0-1 的触发概率，按 score 降序排列。最多 ${topN} 个。如无任何匹配，返回空数组 []。`,
        },
        { role: 'user', content: scenario },
    ];
    const content = await callLLM(modelConfig, messages, 2048, 60000);
    try {
        const arr = JSON.parse(stripJsonFence(content));
        if (Array.isArray(arr)) {
            return arr.slice(0, topN).map(x => ({
                name: String(x.name || ''),
                score: typeof x.score === 'number' ? x.score : 0,
            }));
        }
    }
    catch {
        // ignore
    }
    return [];
}
/**
 * 评估指定 Skill 的 description 与场景的匹配度。
 */
async function aiAssessMatch(scenario, skillName, skillDesc, modelConfig) {
    const messages = [
        {
            role: 'system',
            content: `你是一个 Skill description 质量评审专家。评估给定 Skill 的 description 与用户场景的匹配度。

返回 JSON（不要 markdown 代码块）：
{
  "score": 0.85,
  "comment": "简短评估（不超过 80 字），指出 description 与场景的匹配点和不足"
}

score 范围 0-1，越高表示 description 越能让 AI 在该场景下正确触发。`,
        },
        {
            role: 'user',
            content: `场景：${scenario}\n\nSkill 名称：${skillName}\nDescription：${skillDesc}`,
        },
    ];
    const content = await callLLM(modelConfig, messages, 1024, 45000);
    try {
        const obj = JSON.parse(stripJsonFence(content));
        return {
            score: typeof obj.score === 'number' ? Math.max(0, Math.min(1, obj.score)) : 0,
            comment: typeof obj.comment === 'string' ? obj.comment : '',
        };
    }
    catch {
        return { score: 0, comment: 'AI 返回解析失败' };
    }
}
export async function runSandboxTest(options) {
    const { cases, skills, modelConfig, assessMatch = true } = options;
    const results = [];
    for (const tc of cases) {
        const start = Date.now();
        let topSkills = [];
        let triggerRank = 0;
        let triggered = false;
        let triggerScore = 0;
        let matchScore = -1;
        let comment = '';
        try {
            topSkills = await aiPickTopSkills(tc.scenario, skills, modelConfig, 3);
            const idx = topSkills.findIndex(s => s.name === tc.expectedSkill);
            if (idx >= 0) {
                triggered = true;
                triggerRank = idx + 1;
                // 排名越靠前分数越高：1->1.0, 2->0.7, 3->0.4
                triggerScore = idx === 0 ? 1.0 : idx === 1 ? 0.7 : 0.4;
            }
            if (assessMatch) {
                const expected = skills.find(s => s.name === tc.expectedSkill);
                if (expected && expected.description) {
                    const m = await aiAssessMatch(tc.scenario, tc.expectedSkill, expected.description, modelConfig);
                    matchScore = m.score;
                    comment = m.comment;
                }
                else {
                    comment = '期望的 Skill 不存在或缺少 description';
                }
            }
            else if (triggered) {
                comment = `命中 Top ${triggerRank}`;
            }
            else {
                comment = '未命中 Top 3';
            }
        }
        catch (e) {
            comment = `测试异常: ${e instanceof Error ? e.message : String(e)}`;
        }
        results.push({
            scenario: tc.scenario,
            expectedSkill: tc.expectedSkill,
            triggered,
            triggerRank,
            actualTopSkills: topSkills,
            triggerScore,
            matchScore,
            comment,
            duration: Date.now() - start,
        });
    }
    return results;
}
/**
 * 让 AI 根据一个 Skill 的 description 自动生成测试场景。
 */
export async function autoGenerateCases(skill, modelConfig, count = 3) {
    const messages = [
        {
            role: 'system',
            content: `你是一个 Skill 测试用例生成专家。请根据给定 Skill 的 description，生成 ${count} 个用户场景描述（用户在 IDE 里输入的话术），用于测试该 Skill 的触发率。

返回 JSON 数组（不要 markdown 代码块）：
[
  { "scenario": "用户场景描述（自然语言，简洁）", "expectedSkill": "${skill.name}" }
]

要求：
- 每个场景使用不同的话术风格（直接需求/含蓄表达/隐含触发词等）
- 场景要真实、贴近实际使用
- expectedSkill 字段固定为给定 Skill 名称`,
        },
        {
            role: 'user',
            content: `Skill 名称：${skill.name}\nDescription：${skill.description || skill.contentSummary || '无描述'}`,
        },
    ];
    const content = await callLLM(modelConfig, messages, 1024, 45000);
    try {
        const arr = JSON.parse(stripJsonFence(content));
        if (Array.isArray(arr)) {
            return arr.slice(0, count).map(x => ({
                scenario: String(x.scenario || ''),
                expectedSkill: String(x.expectedSkill || skill.name),
            })).filter(c => c.scenario);
        }
    }
    catch {
        // ignore
    }
    return [];
}
// ==================== Aggregate metrics ====================
export function aggregateResults(results) {
    if (results.length === 0)
        return { triggerAccuracy: 0, avgMatchScore: 0 };
    const triggerAccuracy = results.filter(r => r.triggered).length / results.length;
    const matchScores = results.map(r => r.matchScore).filter(s => s >= 0);
    const avgMatchScore = matchScores.length > 0
        ? matchScores.reduce((a, b) => a + b, 0) / matchScores.length
        : 0;
    return { triggerAccuracy, avgMatchScore };
}
