import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Play,
  Square,
  RefreshCw,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Zap,
  Clock,
  Target,
  ArrowRight,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { toast } from 'sonner'
import { useConfigStore } from '@/stores/configStore'
import type { RubricReport } from './SkillHealthDialog'

// ─── Types ───────────────────────────────────────────────────

interface EvalLoopConfig {
  targetScore: number
  maxRounds: number
  minImprovement: number
}

interface EvalLoopRound {
  round: number
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  report: RubricReport
  improvements: string[]
  versionId?: string
  duration: number
}

interface EvalLoopResult {
  id: string
  skillName: string
  skillPath: string
  config: EvalLoopConfig
  status: 'running' | 'completed' | 'stopped' | 'failed'
  exitReason: 'target_reached' | 'max_rounds' | 'low_improvement' | 'user_stopped' | 'error'
  rounds: EvalLoopRound[]
  startedAt: string
  completedAt?: string
  initialScore: number
  finalScore: number
}

interface HistoryItem {
  id: string
  status: string
  exitReason: string
  initialScore: number
  finalScore: number
  rounds: EvalLoopRound[]
  startedAt: string
  completedAt?: string
}

export interface EvalLoopPanelProps {
  skillPath: string
  skillName: string
  onComplete?: () => void
}

// ─── Constants ───────────────────────────────────────────────

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-green-500 text-white',
  B: 'bg-blue-500 text-white',
  C: 'bg-yellow-500 text-white',
  D: 'bg-orange-500 text-white',
  F: 'bg-red-500 text-white',
}

const EXIT_REASON_LABELS: Record<string, string> = {
  target_reached: '🎯 已达目标分数',
  max_rounds: '🔄 已达最大轮次',
  low_improvement: '📉 提升幅度过低',
  user_stopped: '⏹️ 用户手动停止',
  error: '❌ 发生错误',
}

// ─── SSE Parser ──────────────────────────────────────────────

function parseSSEEvents(chunk: string): Array<{ event: string; data: string }> {
  const events: Array<{ event: string; data: string }> = []
  const blocks = chunk.split('\n\n')
  for (const block of blocks) {
    if (!block.trim()) continue
    let eventType = 'message'
    let dataLines: string[] = []
    for (const line of block.split('\n')) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim()
      } else if (line.startsWith('data: ')) {
        dataLines.push(line.slice(6))
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5))
      }
    }
    if (dataLines.length > 0) {
      events.push({ event: eventType, data: dataLines.join('\n') })
    }
  }
  return events
}

// ─── Component ───────────────────────────────────────────────

type Phase = 'config' | 'running' | 'completed'

export default function EvalLoopPanel({ skillPath, skillName, onComplete }: EvalLoopPanelProps) {
  const { llmModels, defaultModelId } = useConfigStore()

  // Config state
  const [targetScore, setTargetScore] = useState(85)
  const [maxRounds, setMaxRounds] = useState(5)
  const [minImprovement, setMinImprovement] = useState(2)

  // Runtime state
  const [phase, setPhase] = useState<Phase>('config')
  const [rounds, setRounds] = useState<EvalLoopRound[]>([])
  const [result, setResult] = useState<EvalLoopResult | null>(null)
  const [loopId, setLoopId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [stopping, setStopping] = useState(false)

  // History state
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Completed round expansion
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(new Set())

  // SSE abort
  const abortRef = useRef<AbortController | null>(null)
  const sseBufferRef = useRef('')

  // ─── Fetch history ───────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const resp = await fetch(`/api/eval-loop/history?skillPath=${encodeURIComponent(skillPath)}`)
      if (resp.ok) {
        const data = await resp.json()
        setHistory(Array.isArray(data) ? data.slice(0, 5) : [])
      }
    } catch {
      // silently ignore
    } finally {
      setHistoryLoading(false)
    }
  }, [skillPath])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // Check for active loop on mount
  useEffect(() => {
    const checkActive = async () => {
      try {
        const resp = await fetch('/api/eval-loop/active')
        if (resp.ok) {
          const data = await resp.json()
          if (data && data.skillPath === skillPath && data.status === 'running') {
            setLoopId(data.id)
            setRounds(data.rounds || [])
            setPhase('running')
          }
        }
      } catch {
        // ignore
      }
    }
    checkActive()
  }, [skillPath])

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  // ─── Start loop ──────────────────────────────────────────

  const handleStart = async () => {
    const model = llmModels.find(m => m.id === defaultModelId) || llmModels[0]
    if (!model) {
      toast.error('请先在配置中添加并选择默认模型')
      return
    }

    setStarting(true)
    setRounds([])
    setResult(null)
    setExpandedRounds(new Set())
    sseBufferRef.current = ''

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const resp = await fetch('/api/eval-loop/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillPath,
          skillName,
          config: { targetScore, maxRounds, minImprovement },
          baseUrl: model.baseUrl,
          apiKey: model.apiKey,
          modelName: model.modelName,
        }),
        signal: controller.signal,
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${resp.status}`)
      }

      setPhase('running')
      setStarting(false)

      // Read SSE stream
      const reader = resp.body?.getReader()
      if (!reader) throw new Error('无法读取响应流')

      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        sseBufferRef.current += decoder.decode(value, { stream: true })
        const events = parseSSEEvents(sseBufferRef.current)

        // Keep unprocessed trailing content
        const lastDoubleNewline = sseBufferRef.current.lastIndexOf('\n\n')
        if (lastDoubleNewline >= 0) {
          sseBufferRef.current = sseBufferRef.current.slice(lastDoubleNewline + 2)
        }

        for (const sseEvent of events) {
          try {
            const payload = JSON.parse(sseEvent.data)

            if (sseEvent.event === 'round') {
              const roundData = payload as EvalLoopRound
              setRounds(prev => [...prev, roundData])
              if (payload.loopId) setLoopId(payload.loopId)
            } else if (sseEvent.event === 'complete') {
              const resultData = payload as EvalLoopResult
              setResult(resultData)
              setRounds(resultData.rounds)
              setPhase('completed')
              setLoopId(null)
              fetchHistory()
              onComplete?.()
            } else if (sseEvent.event === 'error') {
              toast.error(`优化出错: ${payload.message || '未知错误'}`)
              setPhase('completed')
              setLoopId(null)
              if (payload.result) {
                setResult(payload.result)
                setRounds(payload.result.rounds || [])
              }
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return
      toast.error(`启动优化失败: ${error instanceof Error ? error.message : '未知错误'}`)
      setPhase('config')
    } finally {
      setStarting(false)
    }
  }

  // ─── Stop loop ───────────────────────────────────────────

  const handleStop = async () => {
    if (!loopId) return
    setStopping(true)
    try {
      await fetch('/api/eval-loop/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loopId }),
      })
      abortRef.current?.abort()
    } catch {
      toast.error('停止优化失败')
    } finally {
      setStopping(false)
    }
  }

  // ─── Reset to config ────────────────────────────────────

  const handleReset = () => {
    setPhase('config')
    setRounds([])
    setResult(null)
    setLoopId(null)
    setExpandedRounds(new Set())
    fetchHistory()
  }

  // ─── Toggle round expansion ─────────────────────────────

  const toggleRound = (roundNumber: number) => {
    setExpandedRounds(prev => {
      const next = new Set(prev)
      if (next.has(roundNumber)) next.delete(roundNumber)
      else next.add(roundNumber)
      return next
    })
  }

  // ─── Chart data ──────────────────────────────────────────

  const chartData = rounds.map(r => ({
    round: `第${r.round}轮`,
    score: r.score,
  }))

  // ─── Render: Score trend chart ───────────────────────────

  const renderChart = () => {
    if (chartData.length === 0) return null
    return (
      <div className="rounded-lg border p-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 mb-2">
          <TrendingUp className="h-3.5 w-3.5" />
          评分趋势
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="round" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--background))',
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#7c3aed"
              strokeWidth={2}
              dot={{ fill: '#7c3aed', r: 4 }}
              activeDot={{ r: 6 }}
              name="评分"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // ─── Render: Config phase ────────────────────────────────

  if (phase === 'config') {
    return (
      <div className="space-y-4">
        {/* Config inputs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">目标分数</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={targetScore}
              onChange={e => setTargetScore(Math.min(100, Math.max(0, Number(e.target.value))))}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">最大轮次</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={maxRounds}
              onChange={e => setMaxRounds(Math.min(20, Math.max(1, Number(e.target.value))))}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">最小提升</Label>
            <Input
              type="number"
              min={0}
              max={10}
              value={minImprovement}
              onChange={e => setMinImprovement(Math.min(10, Math.max(0, Number(e.target.value))))}
              className="h-8 text-sm"
            />
          </div>
        </div>

        {/* Start button */}
        <div className="flex justify-center">
          <Button
            className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
            onClick={handleStart}
            disabled={starting}
          >
            {starting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                启动中...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                启动优化
              </>
            )}
          </Button>
        </div>

        {/* History */}
        {renderHistory()}
      </div>
    )
  }

  // ─── Render: Running phase ───────────────────────────────

  if (phase === 'running') {
    const currentRound = rounds[rounds.length - 1]
    const progress = rounds.length / maxRounds

    return (
      <div className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>优化进度</span>
            <span>第 {rounds.length} / {maxRounds} 轮</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-purple-600 transition-all duration-500"
              style={{ width: `${Math.min(progress * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Current round score */}
        {currentRound && (
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold ${GRADE_COLORS[currentRound.grade]}`}>
                {currentRound.grade}
              </div>
              <div>
                <div className="text-lg font-bold">{currentRound.score} 分</div>
                <div className="text-xs text-muted-foreground">第 {currentRound.round} 轮评分</div>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs gap-1">
              <Clock className="h-3 w-3" />
              {(currentRound.duration / 1000).toFixed(1)}s
            </Badge>
          </div>
        )}

        {/* Chart */}
        {renderChart()}

        {/* Current improvements */}
        {currentRound && currentRound.improvements.length > 0 && (
          <div className="rounded-lg border p-3 space-y-1.5">
            <div className="text-xs font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              本轮改进
            </div>
            <ul className="space-y-1">
              {currentRound.improvements.map((item, index) => (
                <li key={index} className="text-xs flex gap-1.5">
                  <span className="text-purple-500 shrink-0">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Waiting indicator when no rounds yet */}
        {rounds.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
            <span className="text-xs text-muted-foreground">正在执行第 1 轮评测...</span>
          </div>
        )}

        {/* Stop button */}
        <div className="flex justify-center">
          <Button
            variant="destructive"
            className="gap-1.5"
            onClick={handleStop}
            disabled={stopping}
          >
            {stopping ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                停止中...
              </>
            ) : (
              <>
                <Square className="h-4 w-4" />
                停止优化
              </>
            )}
          </Button>
        </div>
      </div>
    )
  }

  // ─── Render: Completed phase ─────────────────────────────

  function renderCompleted() {
    const scoreImprovement = result
      ? result.finalScore - result.initialScore
      : rounds.length >= 2
        ? rounds[rounds.length - 1].score - rounds[0].score
        : 0

    const initialScore = result?.initialScore ?? (rounds.length > 0 ? rounds[0].score : 0)
    const finalScore = result?.finalScore ?? (rounds.length > 0 ? rounds[rounds.length - 1].score : 0)
    const exitReason = result?.exitReason ?? 'completed'

    return (
      <div className="space-y-4">
        {/* Summary card */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-purple-700 dark:text-purple-300">
            <Target className="h-4 w-4" />
            优化结果
          </div>

          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-muted-foreground">{initialScore}</div>
              <div className="text-[10px] text-muted-foreground">初始分</div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{finalScore}</div>
              <div className="text-[10px] text-muted-foreground">最终分</div>
            </div>
            <Badge
              className={`text-xs ${scoreImprovement > 0 ? 'bg-green-500 text-white' : scoreImprovement === 0 ? 'bg-gray-400 text-white' : 'bg-red-500 text-white'}`}
            >
              {scoreImprovement > 0 ? '+' : ''}{scoreImprovement} 分
            </Badge>
          </div>

          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span>共 {rounds.length} 轮</span>
            <span>·</span>
            <span>{EXIT_REASON_LABELS[exitReason] || exitReason}</span>
          </div>
        </div>

        {/* Chart */}
        {renderChart()}

        {/* Per-round details */}
        {rounds.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-muted-foreground">各轮详情</div>
            {rounds.map(roundItem => {
              const isExpanded = expandedRounds.has(roundItem.round)
              return (
                <div key={roundItem.round} className="rounded border">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => toggleRound(roundItem.round)}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      {isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      }
                      <span className="font-medium">第 {roundItem.round} 轮</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {(roundItem.duration / 1000).toFixed(1)}s
                      </Badge>
                      <Badge className={`text-[10px] ${GRADE_COLORS[roundItem.grade]}`}>
                        {roundItem.score} 分 ({roundItem.grade})
                      </Badge>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-t px-3 pb-2.5 pt-2 space-y-2 text-xs">
                      {roundItem.improvements.length > 0 && (
                        <div className="space-y-1">
                          <div className="font-medium text-purple-700 dark:text-purple-300">改进内容</div>
                          <ul className="space-y-0.5">
                            {roundItem.improvements.map((imp, idx) => (
                              <li key={idx} className="flex gap-1.5">
                                <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                                <span>{imp}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {roundItem.versionId && (
                        <div className="text-[10px] text-muted-foreground">
                          版本: {roundItem.versionId}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Restart button */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            className="gap-1.5 border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-950/30"
            onClick={handleReset}
          >
            <RefreshCw className="h-4 w-4" />
            再次优化
          </Button>
        </div>

        {/* History */}
        {renderHistory()}
      </div>
    )
  }

  // ─── Render: History ─────────────────────────────────────

  function renderHistory() {
    return (
      <div className="space-y-1.5 pt-2">
        <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          历史记录
        </div>
        {historyLoading ? (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-xs text-muted-foreground py-2 text-center">暂无历史记录</div>
        ) : (
          <div className="space-y-1">
            {history.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded border px-2.5 py-1.5 text-xs"
              >
                <div className="flex items-center gap-2">
                  {item.status === 'completed' ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  ) : item.status === 'failed' ? (
                    <XCircle className="h-3 w-3 text-red-500" />
                  ) : (
                    <Clock className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className="text-muted-foreground">
                    {new Date(item.startedAt).toLocaleDateString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span>{item.initialScore}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">{item.finalScore}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {item.rounds?.length || 0}轮
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return renderCompleted()
}
