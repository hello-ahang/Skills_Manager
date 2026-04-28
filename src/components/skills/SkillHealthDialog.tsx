import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Sparkles,
  AlertCircle,
  AlertTriangle,
  Info,
  Loader2,
  CheckCircle2,
  XCircle,
  Minus,
  ChevronDown,
  ChevronRight,
  Radar,
  ShieldCheck,
} from 'lucide-react'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar as RechartsRadar,
  ResponsiveContainer,
} from 'recharts'
import { toast } from 'sonner'
import { useConfigStore } from '@/stores/configStore'

export interface LintIssue {
  level: 'error' | 'warning' | 'info'
  rule: string
  message: string
  suggestion?: string
}

export interface SkillMetrics {
  descLength: number
  fileSize: number
  refsCount: number
  hasFrontmatter: boolean
  hasName: boolean
  hasDescription: boolean
}

export interface AIAssessment {
  descQualityScore: number
  descSuggestions: string[]
}

export interface SkillHealthReport {
  skillName: string
  skillPath: string
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  issues: LintIssue[]
  metrics: SkillMetrics
  aiAssessment?: AIAssessment
}

export interface RubricItemReport {
  itemId: string
  result: 'pass' | 'fail' | 'skip'
  score: number
  weight: number
  detail: string
  suggestion?: string
}

export interface RubricDimensionReport {
  dimensionId: string
  label: string
  weight: number
  score: number
  items: RubricItemReport[]
}

export interface RubricReport {
  skillName: string
  skillPath: string
  templateId: string
  overallScore: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  dimensions: RubricDimensionReport[]
  evaluatedAt: string
}

interface SkillHealthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  report: SkillHealthReport | null
  description?: string
}

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-green-500 text-white',
  B: 'bg-blue-500 text-white',
  C: 'bg-yellow-500 text-white',
  D: 'bg-orange-500 text-white',
  F: 'bg-red-500 text-white',
}

const LEVEL_CONFIG = {
  error: {
    icon: AlertCircle,
    label: '错误',
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900',
  },
  warning: {
    icon: AlertTriangle,
    label: '警告',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900',
  },
  info: {
    icon: Info,
    label: '提示',
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900',
  },
} as const

export default function SkillHealthDialog({
  open,
  onOpenChange,
  report,
  description,
}: SkillHealthDialogProps) {
  const [aiAssessment, setAiAssessment] = useState<AIAssessment | null>(report?.aiAssessment ?? null)
  const [aiLoading, setAiLoading] = useState(false)
  const { llmModels, defaultModelId } = useConfigStore()

  const [rubricReport, setRubricReport] = useState<RubricReport | null>(null)
  const [rubricLoading, setRubricLoading] = useState(false)
  const [rubricAiLoading, setRubricAiLoading] = useState(false)
  const [expandedDimensions, setExpandedDimensions] = useState<Set<string>>(new Set())

  // Sync aiAssessment when report changes (e.g. from batch AI assess)
  useEffect(() => {
    setAiAssessment(report?.aiAssessment ?? null)
  }, [report])

  // Fetch rubric report when dialog opens
  useEffect(() => {
    if (!open || !report) return
    setRubricReport(null)
    setExpandedDimensions(new Set())
    fetchRubricReport(false)
  }, [open, report?.skillPath])

  const fetchRubricReport = async (includeAI: boolean) => {
    if (!report) return
    const setLoading = includeAI ? setRubricAiLoading : setRubricLoading
    setLoading(true)
    try {
      const body: Record<string, unknown> = { skillPath: report.skillPath }
      if (includeAI) {
        body.includeAI = true
        const model = llmModels.find(m => m.id === defaultModelId) || llmModels[0]
        if (!model) {
          toast.error('请先在配置中添加并选择默认模型')
          return
        }
        body.baseUrl = model.baseUrl
        body.apiKey = model.apiKey
        body.modelName = model.modelName
      }
      const resp = await fetch('/api/skill-rubric/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${resp.status}`)
      }
      const data: RubricReport = await resp.json()
      setRubricReport(data)
      if (includeAI) toast.success('AI 深度评测完成')
    } catch (e) {
      toast.error(`Rubric 评测失败: ${e instanceof Error ? e.message : '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }

  const toggleDimension = (dimensionId: string) => {
    setExpandedDimensions(prev => {
      const next = new Set(prev)
      if (next.has(dimensionId)) next.delete(dimensionId)
      else next.add(dimensionId)
      return next
    })
  }

  if (!report) return null

  const errors = report.issues.filter(i => i.level === 'error')
  const warnings = report.issues.filter(i => i.level === 'warning')
  const infos = report.issues.filter(i => i.level === 'info')

  const handleAiAssess = async () => {
    if (!description) {
      toast.error('该 Skill 缺少 description，无法进行 AI 评估')
      return
    }
    const model = llmModels.find(m => m.id === defaultModelId) || llmModels[0]
    if (!model) {
      toast.error('请先在配置中添加并选择默认模型')
      return
    }
    setAiLoading(true)
    try {
      const resp = await fetch('/api/skill-lint/ai-assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillName: report.skillName,
          description,
          baseUrl: model.baseUrl,
          apiKey: model.apiKey,
          modelName: model.modelName,
        }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${resp.status}`)
      }
      const data = await resp.json()
      setAiAssessment(data.assessment)
      toast.success('AI 评估完成')
    } catch (e) {
      toast.error(`AI 评估失败: ${e instanceof Error ? e.message : '未知错误'}`)
    } finally {
      setAiLoading(false)
    }
  }

  const renderIssueGroup = (level: 'error' | 'warning' | 'info', issues: LintIssue[]) => {
    if (issues.length === 0) return null
    const cfg = LEVEL_CONFIG[level]
    const Icon = cfg.icon
    return (
      <div className="space-y-1.5">
        <div className={`flex items-center gap-1.5 text-xs font-semibold ${cfg.color}`}>
          <Icon className="h-3.5 w-3.5" />
          {cfg.label} ({issues.length})
        </div>
        <div className="space-y-1.5">
          {issues.map((issue, i) => (
            <div key={i} className={`rounded border px-2.5 py-2 text-xs ${cfg.bg}`}>
              <div className="flex items-start gap-2">
                <code className="shrink-0 rounded bg-background/60 px-1 text-[10px]">
                  {issue.rule}
                </code>
                <div className="flex-1 space-y-1">
                  <div className="font-medium">{issue.message}</div>
                  {issue.suggestion && (
                    <div className="text-muted-foreground text-[11px]">
                      💡 {issue.suggestion}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Skill 健康度报告
            <span className="text-sm font-normal text-muted-foreground">
              {report.skillName}
            </span>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="rubric" className="flex-1 flex flex-col min-h-0">
          <TabsList className="shrink-0">
            <TabsTrigger value="lint">Lint 检测</TabsTrigger>
            <TabsTrigger value="rubric">Rubric 评测</TabsTrigger>
          </TabsList>

          {/* ===== Tab 1: Lint 检测 (原有内容完整保留) ===== */}
          <TabsContent value="lint" className="flex-1 min-h-0">
            <ScrollArea className="h-full pr-3">
              <div className="space-y-4 py-2">
                {/* Score header */}
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold ${GRADE_COLORS[report.grade]}`}
                    >
                      {report.grade}
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{report.score} / 100</div>
                      <div className="text-xs text-muted-foreground">健康度评分</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span className="text-muted-foreground">Description:</span>
                    <span>{report.metrics.descLength} 字符</span>
                    <span className="text-muted-foreground">SKILL.md:</span>
                    <span>{report.metrics.fileSize} 行</span>
                    <span className="text-muted-foreground">References:</span>
                    <span>{report.metrics.refsCount} 个</span>
                    <span className="text-muted-foreground">Frontmatter:</span>
                    <span>{report.metrics.hasFrontmatter ? '✓' : '✗'}</span>
                  </div>
                </div>

                {/* Issues */}
                {report.issues.length === 0 ? (
                  <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400">
                    ✓ 该 Skill 通过所有静态检测，无任何问题
                  </div>
                ) : (
                  <div className="space-y-3">
                    {renderIssueGroup('error', errors)}
                    {renderIssueGroup('warning', warnings)}
                    {renderIssueGroup('info', infos)}
                  </div>
                )}

                {/* AI Assessment */}
                <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3 dark:border-purple-900 dark:bg-purple-950/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300">
                      <Sparkles className="h-3.5 w-3.5" />
                      AI 评估 description 质量（消耗 token）
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={handleAiAssess}
                      disabled={aiLoading || !description}
                    >
                      {aiLoading ? (
                        <>
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          评估中...
                        </>
                      ) : (
                        aiAssessment ? '重新评估' : '开始评估'
                      )}
                    </Button>
                  </div>
                  {aiAssessment && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          AI 评分: {aiAssessment.descQualityScore} / 100
                        </Badge>
                      </div>
                      {aiAssessment.descSuggestions.length > 0 && (
                        <ul className="space-y-1 text-xs">
                          {aiAssessment.descSuggestions.map((s, i) => (
                            <li key={i} className="flex gap-1.5">
                              <span className="text-purple-600 dark:text-purple-400">•</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  {!aiAssessment && !aiLoading && (
                    <div className="text-xs text-muted-foreground">
                      点击"开始评估"调用 AI 模型对 description 进行质量打分和改进建议（默认使用配置中的默认模型）
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ===== Tab 2: Rubric 评测 (新增) ===== */}
          <TabsContent value="rubric" className="flex-1 min-h-0">
            <ScrollArea className="h-full pr-3">
              <div className="space-y-4 py-2">
                {rubricLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                    <span className="text-sm text-muted-foreground">正在进行 Rubric 评测...</span>
                  </div>
                ) : rubricReport ? (
                  <>
                    {/* 雷达图 */}
                    <div className="rounded-lg border p-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 mb-2">
                        <Radar className="h-3.5 w-3.5" />
                        四维评测雷达图
                      </div>
                      <ResponsiveContainer width="100%" height={240}>
                        <RadarChart
                          data={rubricReport.dimensions.map(d => ({
                            dimension: d.label,
                            score: d.score,
                            fullMark: 100,
                          }))}
                        >
                          <PolarGrid />
                          <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12 }} />
                          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                          <RechartsRadar
                            name="得分"
                            dataKey="score"
                            stroke="#7c3aed"
                            fill="#8b5cf6"
                            fillOpacity={0.3}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* 总分 + 等级 */}
                    <div className="flex items-center justify-center gap-4 rounded-lg border p-3">
                      <div
                        className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold ${GRADE_COLORS[rubricReport.grade]}`}
                      >
                        {rubricReport.grade}
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{rubricReport.overallScore} / 100</div>
                        <div className="text-xs text-muted-foreground">Rubric 综合评分</div>
                      </div>
                    </div>

                    {/* 各维度逐项展开 */}
                    <div className="space-y-2">
                      {rubricReport.dimensions.map(dimension => {
                        const isExpanded = expandedDimensions.has(dimension.dimensionId)
                        return (
                          <div key={dimension.dimensionId} className="rounded-lg border">
                            <button
                              type="button"
                              className="flex w-full items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
                              onClick={() => toggleDimension(dimension.dimensionId)}
                            >
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className="text-sm font-medium">
                                  {dimension.dimensionId} {dimension.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  权重 {Math.round(dimension.weight * 100)}%
                                </Badge>
                                <Badge
                                  className={`text-xs ${
                                    dimension.score >= 80
                                      ? 'bg-green-500 text-white'
                                      : dimension.score >= 60
                                        ? 'bg-yellow-500 text-white'
                                        : 'bg-red-500 text-white'
                                  }`}
                                >
                                  {dimension.score} 分
                                </Badge>
                              </div>
                            </button>
                            {isExpanded && (
                              <div className="border-t px-3 pb-3 pt-2 space-y-2">
                                {dimension.items.map(item => (
                                  <div
                                    key={item.itemId}
                                    className="flex items-start gap-2 rounded border px-2.5 py-2 text-xs bg-muted/30"
                                  >
                                    <span className="mt-0.5 shrink-0">
                                      {item.result === 'pass' && (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                      )}
                                      {item.result === 'fail' && (
                                        <XCircle className="h-3.5 w-3.5 text-red-600" />
                                      )}
                                      {item.result === 'skip' && (
                                        <Minus className="h-3.5 w-3.5 text-gray-400" />
                                      )}
                                    </span>
                                    <div className="flex-1 space-y-1">
                                      <div className="font-medium">{item.detail}</div>
                                      {item.suggestion && (
                                        <div className="text-muted-foreground text-[11px]">
                                          💡 {item.suggestion}
                                        </div>
                                      )}
                                    </div>
                                    <Badge variant="outline" className="text-[10px] shrink-0">
                                      {item.score} 分
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* 一键 AI 深度评测按钮 */}
                    <div className="flex justify-center pt-1">
                      <Button
                        variant="outline"
                        className="gap-1.5 border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-950/30"
                        onClick={() => fetchRubricReport(true)}
                        disabled={rubricAiLoading}
                      >
                        {rubricAiLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            AI 深度评测中...
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-4 w-4" />
                            一键 AI 深度评测
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                    <Radar className="h-8 w-8" />
                    <span className="text-sm">评测数据加载失败，请关闭后重试</span>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
