import { useEffect, useState } from 'react'
import { useConfigStore } from '@/stores/configStore'
import { useRadarStore } from '@/stores/radarStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import SearchableSkillSelect from '@/components/skills/SearchableSkillSelect'
import {
  Loader2,
  Plus,
  Trash2,
  PlayCircle,
  History,
  AlertCircle,
  CheckCircle2,
  XCircle,
  X,
  Target,
  ClipboardList,
  Wand2,
  FileEdit,
} from 'lucide-react'
import { toast } from 'sonner'

// ==================== Types (mirror backend) ====================

type SandboxMode = 'manual' | 'ai-generated'

interface TestCase {
  scenario: string
  expectedSkill: string
}

interface TopMatch {
  name: string
  score: number
}

interface TestResult {
  scenario: string
  expectedSkill: string
  triggered: boolean
  triggerRank: number
  actualTopSkills: TopMatch[]
  triggerScore: number
  matchScore: number
  comment: string
  duration: number
}

interface HistoryEntry {
  id: string
  timestamp: number
  modelName: string
  mode?: SandboxMode
  cases: TestCase[]
  results: TestResult[]
  triggerAccuracy: number
  avgMatchScore: number
}

// ==================== Component ====================

export default function SandboxPanel() {
  const { skills } = useRadarStore()
  const { llmModels, defaultModelId } = useConfigStore()
  const defaultModel =
    llmModels.find(m => m.id === defaultModelId && m.tested) ||
    llmModels.find(m => m.tested) ||
    null
  const hasModel = !!defaultModel

  const [cases, setCases] = useState<TestCase[]>([
    { scenario: '', expectedSkill: '' },
  ])
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<TestResult[]>([])
  const [aggregate, setAggregate] = useState<{
    triggerAccuracy: number
    avgMatchScore: number
  } | null>(null)
  const [assessMatch, setAssessMatch] = useState(true)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [autoGenSkill, setAutoGenSkill] = useState<string>('')
  const [autoGenLoading, setAutoGenLoading] = useState(false)

  // 测试模式 Tab：手动配置 / AI 自动生成
  const [tabMode, setTabMode] = useState<SandboxMode>('manual')

  // 切换 Tab 时清空当前未提交的 cases 和上一次的结果，避免混淆
  const switchTab = (newMode: SandboxMode) => {
    if (newMode === tabMode) return
    setTabMode(newMode)
    setCases([{ scenario: '', expectedSkill: '' }])
    setResults([])
    setAggregate(null)
    setAutoGenSkill('')
  }

  // Skills 选项（仅用 name 字段供选择）
  const skillNames = skills.map(s => s.name)

  // 加载示例数据：用当前 skills 库前 3 个生成示例 case（仅 manual Tab 使用）
  const handleLoadExamples = () => {
    if (skills.length === 0) {
      toast.error('当前 Skills 库为空，无法生成示例数据')
      return
    }
    const examples: TestCase[] = skills.slice(0, 3).map(s => ({
      scenario: `示例：我想${(s.description || '使用该能力').slice(0, 40)}`,
      expectedSkill: s.name,
    }))
    setCases(prev => {
      const nonEmpty = prev.filter(c => c.scenario.trim() || c.expectedSkill.trim())
      return [...nonEmpty, ...examples]
    })
    toast.success(`已加载 ${examples.length} 个示例场景`)
  }

  // ===== History API =====
  const loadHistory = async () => {
    try {
      const resp = await fetch('/api/sandbox/history')
      if (!resp.ok) return
      const data = await resp.json()
      setHistory(data.history || [])
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])

  const handleClearHistory = async () => {
    try {
      await fetch('/api/sandbox/history', { method: 'DELETE' })
      setHistory([])
      toast.success('历史已清空')
    } catch {
      toast.error('清空失败')
    }
  }

  // ===== Cases manipulation =====
  const addCase = () => {
    setCases(prev => [...prev, { scenario: '', expectedSkill: '' }])
  }
  const removeCase = (idx: number) => {
    setCases(prev => prev.filter((_, i) => i !== idx))
  }
  const updateCase = (idx: number, patch: Partial<TestCase>) => {
    setCases(prev => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)))
  }

  // ===== AI auto-generate cases =====
  const handleAutoGenerate = async () => {
    if (!autoGenSkill) {
      toast.error('请先选择要自动生成测试场景的 Skill')
      return
    }
    if (!hasModel) {
      toast.error('请先配置并测试默认模型')
      return
    }
    const target = skills.find(s => s.name === autoGenSkill)
    if (!target) {
      toast.error('未找到该 Skill')
      return
    }
    setAutoGenLoading(true)
    try {
      const resp = await fetch('/api/sandbox/auto-generate-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill: {
            name: target.name,
            description: target.description,
            contentSummary: target.contentSummary,
          },
          baseUrl: defaultModel!.baseUrl,
          apiKey: defaultModel!.apiKey,
          modelName: defaultModel!.modelName,
          count: 3,
        }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${resp.status}`)
      }
      const data = await resp.json()
      const generated: TestCase[] = data.cases || []
      if (generated.length === 0) {
        toast.warning('AI 未生成任何场景')
        return
      }
      // AI 生成 Tab：直接覆盖 cases（不与已有合并），更符合"AI 一键生成"心智
      // 手动 Tab：追加到现有 cases（过滤空 case）
      if (tabMode === 'ai-generated') {
        setCases(generated)
      } else {
        setCases(prev => {
          const nonEmpty = prev.filter(c => c.scenario.trim() || c.expectedSkill.trim())
          return [...nonEmpty, ...generated]
        })
      }
      toast.success(`已自动生成 ${generated.length} 个测试场景`)
    } catch (e) {
      toast.error(`自动生成失败: ${e instanceof Error ? e.message : '未知错误'}`)
    } finally {
      setAutoGenLoading(false)
    }
  }

  // ===== Run test =====
  const handleRunTest = async () => {
    const valid = cases.filter(c => c.scenario.trim() && c.expectedSkill.trim())
    if (valid.length === 0) {
      toast.error('请至少添加一个有效的测试场景（场景 + 期望 Skill）')
      return
    }
    if (!hasModel) {
      toast.error('请先配置并测试默认模型')
      return
    }
    if (skills.length === 0) {
      toast.error('当前没有可测试的 Skills，请先在 Skills 库中添加')
      return
    }

    setRunning(true)
    setResults([])
    setAggregate(null)
    try {
      const resp = await fetch('/api/sandbox/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cases: valid,
          skills: skills.map(s => ({
            name: s.name,
            description: s.description,
            contentSummary: s.contentSummary,
          })),
          baseUrl: defaultModel!.baseUrl,
          apiKey: defaultModel!.apiKey,
          modelName: defaultModel!.modelName,
          assessMatch,
          mode: tabMode,
        }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${resp.status}`)
      }
      const data = await resp.json()
      setResults(data.results || [])
      setAggregate({
        triggerAccuracy: data.triggerAccuracy || 0,
        avgMatchScore: data.avgMatchScore || 0,
      })
      toast.success(`测试完成（${valid.length} 个场景）`)
      // 刷新历史
      loadHistory()
    } catch (e) {
      toast.error(`测试失败: ${e instanceof Error ? e.message : '未知错误'}`)
    } finally {
      setRunning(false)
    }
  }

  // ===== Render helpers =====
  const renderResultRow = (r: TestResult, i: number) => {
    return (
      <tr key={i} className="border-b last:border-0 align-top">
        <td className="px-3 py-2 text-xs">{i + 1}</td>
        <td className="px-3 py-2 text-xs max-w-xs">
          <div className="font-medium truncate" title={r.scenario}>{r.scenario}</div>
        </td>
        <td className="px-3 py-2 text-xs">
          <code className="rounded bg-muted px-1.5 py-0.5">{r.expectedSkill}</code>
        </td>
        <td className="px-3 py-2 text-xs">
          {r.actualTopSkills.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <ol className="space-y-0.5 list-decimal list-inside">
              {r.actualTopSkills.map((t, j) => (
                <li key={j} className={t.name === r.expectedSkill ? 'text-green-600 dark:text-green-400 font-medium' : ''}>
                  <code className="text-[10px]">{t.name}</code>
                  <span className="text-muted-foreground ml-1">({Math.round(t.score * 100)}%)</span>
                </li>
              ))}
            </ol>
          )}
        </td>
        <td className="px-3 py-2 text-xs">
          {r.triggered ? (
            <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Top {r.triggerRank} ({Math.round(r.triggerScore * 100)}%)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
              <XCircle className="h-3.5 w-3.5" />
              未命中
            </span>
          )}
        </td>
        <td className="px-3 py-2 text-xs">
          {r.matchScore >= 0 ? (
            <span className={
              r.matchScore >= 0.7
                ? 'text-green-600 dark:text-green-400'
                : r.matchScore >= 0.4
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-red-600 dark:text-red-400'
            }>
              {Math.round(r.matchScore * 100)}%
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="px-3 py-2 text-xs text-muted-foreground max-w-xs">
          <div className="line-clamp-2" title={r.comment}>{r.comment}</div>
        </td>
        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
          {(r.duration / 1000).toFixed(1)}s
        </td>
      </tr>
    )
  }

  // 历史按当前 Tab mode 筛选（旧记录无 mode 字段时默认归到 manual）
  const filteredHistory = history.filter(h => (h.mode || 'manual') === tabMode)

  return (
    <div className="space-y-4">
      {/* ==================== 功能介绍 Banner ==================== */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Target className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Skills 测试沙箱</h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          模拟 AI 决策过程，验证你的 Skill <code className="text-[11px] bg-muted px-1 py-0.5 rounded">description</code> 能否在该触发时被准确触发，并量化匹配质量。
        </p>
      </div>

      {/* ==================== Tab 切换 + 历史按钮 ==================== */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1 w-fit">
          <button
            onClick={() => switchTab('manual')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
              tabMode === 'manual'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileEdit className="h-3.5 w-3.5" />
            手动配置场景
          </button>
          <button
            onClick={() => switchTab('ai-generated')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
              tabMode === 'ai-generated'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Wand2 className="h-3.5 w-3.5" />
            AI 自动生成场景
          </button>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => setShowHistory(v => !v)}
        >
          <History className="h-3.5 w-3.5" />
          历史 ({filteredHistory.length})
        </Button>
      </div>

      {!hasModel && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          请先在右上角「模型配置」中添加模型、测试通过并设置默认使用模型
        </div>
      )}

      {/* History panel（按当前 Tab mode 筛选） */}
      {showHistory && (
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">
              {tabMode === 'manual' ? '手动配置' : 'AI 自动生成'}模式历史（最近 50 条）
            </span>
            {history.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-destructive hover:text-destructive"
                onClick={handleClearHistory}
                title="清空全部模式历史"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                清空历史
              </Button>
            )}
          </div>
          {filteredHistory.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center">
              当前模式暂无历史记录
            </p>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {filteredHistory.map(h => (
                <div
                  key={h.id}
                  className="flex items-center justify-between text-xs px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                  onClick={() => {
                    setCases(h.cases)
                    setResults(h.results)
                    setAggregate({
                      triggerAccuracy: h.triggerAccuracy,
                      avgMatchScore: h.avgMatchScore,
                    })
                    setShowHistory(false)
                    toast.success('已加载历史测试结果')
                  }}
                >
                  <div className="flex-1 truncate">
                    <span className="text-muted-foreground">
                      {new Date(h.timestamp).toLocaleString()}
                    </span>
                    <span className="mx-2">·</span>
                    <span>{h.cases.length} 个场景</span>
                    <span className="mx-2">·</span>
                    <code className="text-[10px]">{h.modelName}</code>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="text-green-600 dark:text-green-400">
                      触发 {Math.round(h.triggerAccuracy * 100)}%
                    </span>
                    {h.avgMatchScore > 0 && (
                      <span className="text-blue-600 dark:text-blue-400">
                        匹配 {Math.round(h.avgMatchScore * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== 配置测试场景（按 Tab 模式切换） ==================== */}
      {tabMode === 'manual' ? (
        // ----- Tab1：手动配置场景 -----
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b">
            <div className="flex items-center gap-2">
              <FileEdit className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm font-semibold">手动配置测试场景</span>
              <span className="text-[11px] text-muted-foreground">填写"用户场景"+ 选择"期望触发的 Skill"</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={handleLoadExamples}
                disabled={skills.length === 0}
                title="基于当前 Skills 库前 3 个 Skill 加载示例场景"
              >
                <ClipboardList className="h-3 w-3" />
                加载示例
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addCase}>
                <Plus className="h-3 w-3" />
                添加场景
              </Button>
            </div>
          </div>

          <div className="p-3 space-y-2">
            {cases.map((c, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="shrink-0 text-xs text-muted-foreground mt-2 w-4">{i + 1}.</span>
                <Input
                  placeholder="用户场景描述（如：帮我做代码审查）"
                  value={c.scenario}
                  onChange={e => updateCase(i, { scenario: e.target.value })}
                  className="h-8 text-xs flex-1"
                />
                <SearchableSkillSelect
                  value={c.expectedSkill}
                  onValueChange={v => updateCase(i, { expectedSkill: v })}
                  skills={skills.map(s => ({ name: s.name, description: s.description }))}
                  placeholder="期望触发的 Skill"
                  className="w-56"
                  size="sm"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeCase(i)}
                  disabled={cases.length === 1}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // ----- Tab2：AI 自动生成场景 -----
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b">
            <div className="flex items-center gap-2">
              <Wand2 className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm font-semibold">AI 自动生成测试场景</span>
              <span className="text-[11px] text-muted-foreground">选择目标 Skill，AI 自动生成 3 个测试场景</span>
            </div>
          </div>

          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <SearchableSkillSelect
                value={autoGenSkill}
                onValueChange={setAutoGenSkill}
                skills={skills.map(s => ({ name: s.name, description: s.description }))}
                placeholder="选择目标 Skill"
                className="flex-1"
                size="default"
              />
              <Button
                size="sm"
                className="h-9 text-sm gap-1.5 px-4"
                onClick={handleAutoGenerate}
                disabled={autoGenLoading || !hasModel || !autoGenSkill}
              >
                {autoGenLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" />
                )}
                AI 生成场景
              </Button>
            </div>

            {cases.length === 0 || (cases.length === 1 && !cases[0].scenario && !cases[0].expectedSkill) ? (
              <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-xs text-muted-foreground">
                <Wand2 className="h-5 w-5 mx-auto mb-2 opacity-50" />
                选择目标 Skill 后点击"AI 生成场景"，将自动生成多个用户场景用于测试
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  已生成 {cases.length} 个场景（可编辑、删除）：
                </div>
                {cases.map((c, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="shrink-0 text-xs text-muted-foreground mt-2 w-4">{i + 1}.</span>
                    <Input
                      placeholder="用户场景描述"
                      value={c.scenario}
                      onChange={e => updateCase(i, { scenario: e.target.value })}
                      className="h-8 text-xs flex-1"
                    />
                    <SearchableSkillSelect
                      value={c.expectedSkill}
                      onValueChange={v => updateCase(i, { expectedSkill: v })}
                      skills={skills.map(s => ({ name: s.name, description: s.description }))}
                      placeholder="期望触发的 Skill"
                      className="w-56"
                      size="sm"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeCase(i)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== 运行测试 ==================== */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center px-4 py-2.5 bg-muted/30 border-b gap-2">
          <PlayCircle className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-semibold">运行测试</span>
          <span className="text-[11px] text-muted-foreground">AI 模拟决策给场景打分（消耗 token）</span>
        </div>
        <div className="p-4 flex items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer flex-1">
            <input
              type="checkbox"
              checked={assessMatch}
              onChange={e => setAssessMatch(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            <span>
              <strong className="text-foreground">同时评估 description 匹配度</strong>
              <span className="ml-1.5 text-[11px]">（更耗时但更全面，约多 1 倍 token）</span>
            </span>
          </label>
          <div className="flex flex-col items-end gap-0.5">
            <Button
              size="default"
              className="h-9 px-4 text-sm gap-2"
              onClick={handleRunTest}
              disabled={running || !hasModel}
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  测试中...
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4" />
                  运行测试
                </>
              )}
            </Button>
            <span className="text-[10px] text-muted-foreground">
              约消耗 {cases.filter(c => c.scenario.trim() && c.expectedSkill.trim()).length || 0}×{assessMatch ? 1000 : 500} tokens
            </span>
          </div>
        </div>
      </div>

      {/* ==================== 测试结果 ==================== */}
      {(aggregate || results.length > 0) && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="flex items-center px-4 py-2.5 bg-muted/30 border-b gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            <span className="text-sm font-semibold">测试结果</span>
            <span className="text-[11px] text-muted-foreground">触发准确率 + 匹配度，定位需优化的 Skill</span>
          </div>

          <div className="p-4 space-y-4">
            {/* Aggregate metrics */}
            {aggregate && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-background p-3">
                  <div className="text-xs text-muted-foreground">触发准确率</div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                    {Math.round(aggregate.triggerAccuracy * 100)}%
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5" title="期望 Skill 出现在 AI 推荐 Top 3 的比例">
                    期望 Skill 出现在 Top 3 的比例
                  </div>
                </div>
                <div className="rounded-lg border bg-background p-3">
                  <div className="text-xs text-muted-foreground">平均匹配度</div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                    {aggregate.avgMatchScore > 0
                      ? `${Math.round(aggregate.avgMatchScore * 100)}%`
                      : '—'}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5" title="AI 评估 description 与场景的语义匹配度">
                    AI 评估 description 与场景的语义匹配度
                  </div>
                </div>
              </div>
            )}

            {/* Results table */}
            {results.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <div className="px-3 py-2 border-b text-xs font-medium bg-muted/30">
                  详细测试结果（{results.length} 个场景）
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/20">
                      <tr className="text-left">
                        <th className="px-3 py-2 font-medium">#</th>
                        <th className="px-3 py-2 font-medium">场景</th>
                        <th className="px-3 py-2 font-medium">期望 Skill</th>
                        <th className="px-3 py-2 font-medium">AI 推荐 Top 3</th>
                        <th className="px-3 py-2 font-medium">触发结果</th>
                        <th className="px-3 py-2 font-medium">匹配度</th>
                        <th className="px-3 py-2 font-medium">评估意见</th>
                        <th className="px-3 py-2 font-medium">耗时</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, i) => renderResultRow(r, i))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
