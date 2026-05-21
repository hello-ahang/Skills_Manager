import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Loader2,
  GitCompareArrows,
  Trophy,
  Minus,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar as RechartsRadar,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { toast } from 'sonner'
import { useConfigStore } from '@/stores/configStore'
import { compareApi } from '@/api/client'

// ==================== Types ====================

interface DimensionComparison {
  dimensionId: string
  label: string
  weight: number
  scoreA: number
  scoreB: number
  diff: number
  winner: 'A' | 'B' | 'tie'
}

interface RubricItemReport {
  itemId: string
  result: 'pass' | 'fail' | 'skip'
  score: number
  weight: number
  detail: string
  suggestion?: string
}

interface RubricDimensionReport {
  dimensionId: string
  label: string
  weight: number
  score: number
  items: RubricItemReport[]
}

interface RubricReport {
  skillName: string
  skillPath: string
  templateId: string
  overallScore: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  dimensions: RubricDimensionReport[]
  evaluatedAt: string
}

interface ContentDiffLine {
  type: 'same' | 'added' | 'removed'
  content: string
}

interface CompareReport {
  skillA: { name: string; path: string }
  skillB: { name: string; path: string }
  reportA: RubricReport
  reportB: RubricReport
  dimensions: DimensionComparison[]
  overallDiff: number
  winner: 'A' | 'B' | 'tie'
  contentDiff: ContentDiffLine[]
  comparedAt: string
}

// ==================== Props ====================

interface SkillOption {
  name: string
  path: string
}

interface SkillComparePanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  skills: SkillOption[]
  /** Pre-select skill A (e.g. from context menu) */
  preselectedA?: string
}

// ==================== Grade Badge ====================

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  B: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  C: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  D: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  F: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
}

function GradeBadge({ grade, score }: { grade: string; score: number }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${GRADE_COLORS[grade] || ''}`}
      title={`Rubric 评分: ${score}`}
    >
      {grade}
      <span className="font-normal opacity-70">{Math.round(score)}</span>
    </span>
  )
}

// ==================== Component ====================

export default function SkillComparePanel({
  open,
  onOpenChange,
  skills,
  preselectedA,
}: SkillComparePanelProps) {
  const { llmModels, defaultModelId } = useConfigStore()
  const defaultModel = llmModels.find(m => m.id === defaultModelId && m.tested)
    || llmModels.find(m => m.tested)
    || null

  const [skillPathA, setSkillPathA] = useState(preselectedA || '')
  const [skillPathB, setSkillPathB] = useState('')
  const [includeAI, setIncludeAI] = useState(false)
  const [comparing, setComparing] = useState(false)
  const [report, setReport] = useState<CompareReport | null>(null)
  const [activeTab, setActiveTab] = useState<string>('overview')

  // Reset when preselectedA changes — must run as effect, not in render body.
  useEffect(() => {
    if (preselectedA) {
      setSkillPathA(preselectedA)
    }
  }, [preselectedA])

  const handleCompare = async () => {
    if (!skillPathA || !skillPathB) {
      toast.error('请选择两个 Skill 进行对比')
      return
    }
    if (skillPathA === skillPathB) {
      toast.error('请选择两个不同的 Skill')
      return
    }

    setComparing(true)
    setReport(null)

    try {
      // Server reads model creds from user config — never send them from the
      // client (SSRF + Authorization header leak).
      const wantsAI = includeAI && Boolean(defaultModel)
      const data = await compareApi.compareSkills({
        skillPathA,
        skillPathB,
        includeAI: wantsAI,
      })
      setReport(data.report)
      setActiveTab('overview')
    } catch (error) {
      toast.error(`对比失败: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setComparing(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    // Reset state after close animation
    setTimeout(() => {
      setReport(null)
      setSkillPathA(preselectedA || '')
      setSkillPathB('')
      setActiveTab('overview')
    }, 200)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          onOpenChange(true)
        } else {
          handleClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompareArrows className="h-5 w-5 text-primary" />
            Skill 对比评测
          </DialogTitle>
          <DialogDescription>
            选择两个 Skill 进行 Rubric 对比，并查看两份 SKILL.md 的内容差异
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Skill Selection */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="space-y-1.5">
              <label htmlFor="compare-skill-a" className="text-xs font-medium text-muted-foreground">Skill A</label>
              <select
                id="compare-skill-a"
                value={skillPathA}
                onChange={e => setSkillPathA(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                disabled={comparing}
              >
                <option value="">选择 Skill...</option>
                {skills.map(s => (
                  <option key={`a-${s.path}`} value={s.path}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="compare-skill-b" className="text-xs font-medium text-muted-foreground">Skill B</label>
              <select
                id="compare-skill-b"
                value={skillPathB}
                onChange={e => setSkillPathB(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                disabled={comparing}
              >
                <option value="">选择 Skill...</option>
                {skills.map(s => (
                  <option key={`b-${s.path}`} value={s.path}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Options + Run */}
          <div className="flex items-center justify-between mb-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={includeAI}
                onChange={e => setIncludeAI(e.target.checked)}
                className="h-4 w-4"
                disabled={comparing || !defaultModel}
              />
              <span className={!defaultModel ? 'text-muted-foreground' : ''}>
                包含 AI 评估
                {!defaultModel && <span className="text-xs ml-1">（需配置模型）</span>}
              </span>
            </label>
            <Button
              onClick={handleCompare}
              disabled={comparing || !skillPathA || !skillPathB || skillPathA === skillPathB}
              size="sm"
            >
              {comparing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  对比中...
                </>
              ) : (
                <>
                  <GitCompareArrows className="h-4 w-4 mr-1.5" />
                  开始对比
                </>
              )}
            </Button>
          </div>

          {/* Results */}
          {report && (
            <ScrollArea className="flex-1 min-h-0" style={{ maxHeight: 'calc(85vh - 200px)' }}>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full mb-3">
                  <TabsTrigger value="overview" className="flex-1 text-xs">总览</TabsTrigger>
                  <TabsTrigger value="dimensions" className="flex-1 text-xs">维度详情</TabsTrigger>
                  <TabsTrigger value="diff" className="flex-1 text-xs">内容 Diff</TabsTrigger>
                </TabsList>

                {/* Tab: Overview */}
                <TabsContent value="overview" className="space-y-4">
                  {/* Winner banner */}
                  <div className="rounded-lg border bg-muted/30 p-4 text-center">
                    {report.winner === 'tie' ? (
                      <div className="flex items-center justify-center gap-2 text-sm font-medium">
                        <Minus className="h-4 w-4" />
                        两个 Skill 评分相同
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        <Trophy className="h-4 w-4" />
                        <span>
                          {report.winner === 'A' ? report.skillA.name : report.skillB.name}
                        </span>
                        胜出（差距 {Math.abs(report.overallDiff).toFixed(1)} 分）
                      </div>
                    )}
                  </div>

                  {/* Side-by-side scores */}
                  <div className="grid grid-cols-2 gap-4">
                    <ScoreCard
                      label="Skill A"
                      name={report.skillA.name}
                      report={report.reportA}
                      isWinner={report.winner === 'A'}
                    />
                    <ScoreCard
                      label="Skill B"
                      name={report.skillB.name}
                      report={report.reportB}
                      isWinner={report.winner === 'B'}
                    />
                  </div>

                  {/* Radar chart */}
                  <div className="rounded-lg border p-4">
                    <h3 className="text-sm font-medium mb-2">维度对比雷达图</h3>
                    <CompareRadarChart
                      dimensions={report.dimensions}
                      nameA={report.skillA.name}
                      nameB={report.skillB.name}
                    />
                  </div>
                </TabsContent>

                {/* Tab: Dimension details */}
                <TabsContent value="dimensions" className="space-y-3">
                  {report.dimensions.map(dim => (
                    <DimensionComparisonCard
                      key={dim.dimensionId}
                      dimension={dim}
                      dimReportA={report.reportA.dimensions.find(d => d.dimensionId === dim.dimensionId)}
                      dimReportB={report.reportB.dimensions.find(d => d.dimensionId === dim.dimensionId)}
                      nameA={report.skillA.name}
                      nameB={report.skillB.name}
                    />
                  ))}
                </TabsContent>

                {/* Tab: Content diff */}
                <TabsContent value="diff">
                  <ContentDiffView
                    diff={report.contentDiff}
                    nameA={report.skillA.name}
                    nameB={report.skillB.name}
                  />
                </TabsContent>
              </Tabs>
            </ScrollArea>
          )}

          {/* Empty state */}
          {!report && !comparing && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-muted-foreground">
              <GitCompareArrows className="h-10 w-10 opacity-30" />
              <p className="text-sm">选择两个 Skill，对比它们的 Rubric 评测结果</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ==================== Sub-components ====================

function ScoreCard({
  label,
  name,
  report,
  isWinner,
}: {
  label: string
  name: string
  report: RubricReport
  isWinner: boolean
}) {
  return (
    <div className={`rounded-lg border p-3 space-y-2 ${isWinner ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {isWinner && <Trophy className="h-3.5 w-3.5 text-emerald-500" />}
      </div>
      <p className="text-sm font-semibold truncate" title={name}>{name}</p>
      <div className="flex items-center gap-2">
        <GradeBadge grade={report.grade} score={report.overallScore} />
      </div>
    </div>
  )
}

function CompareRadarChart({
  dimensions,
  nameA,
  nameB,
}: {
  dimensions: DimensionComparison[]
  nameA: string
  nameB: string
}) {
  const data = dimensions.map(d => ({
    dimension: d.label,
    [nameA]: Math.round(d.scoreA),
    [nameB]: Math.round(d.scoreB),
  }))

  return (
    <div>
      <ResponsiveContainer width="100%" height={250}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="60%">
          <PolarGrid />
          <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
          <RechartsRadar
            name={nameA}
            dataKey={nameA}
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.15}
          />
          <RechartsRadar
            name={nameB}
            dataKey={nameB}
            stroke="hsl(25, 95%, 53%)"
            fill="hsl(25, 95%, 53%)"
            fillOpacity={0.15}
          />
        </RadarChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-6 text-xs mt-1">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'hsl(var(--primary))' }} />
          {nameA}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'hsl(25, 95%, 53%)' }} />
          {nameB}
        </span>
      </div>
    </div>
  )
}

function DimensionComparisonCard({
  dimension,
  dimReportA,
  dimReportB,
  nameA,
  nameB,
}: {
  dimension: DimensionComparison
  dimReportA?: RubricDimensionReport
  dimReportB?: RubricDimensionReport
  nameA: string
  nameB: string
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-3 text-left hover:bg-accent/50 rounded-lg"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="text-sm font-medium">{dimension.label}</span>
          <Badge variant="outline" className="text-[10px]">权重 {dimension.weight}</Badge>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span>{nameA}: <strong>{Math.round(dimension.scoreA)}</strong></span>
          <span className={`flex items-center gap-0.5 ${
            dimension.diff > 0 ? 'text-emerald-600' : dimension.diff < 0 ? 'text-red-500' : 'text-muted-foreground'
          }`}>
            {dimension.diff > 0 ? <ArrowUp className="h-3 w-3" /> : dimension.diff < 0 ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {Math.abs(dimension.diff).toFixed(1)}
          </span>
          <span>{nameB}: <strong>{Math.round(dimension.scoreB)}</strong></span>
        </div>
      </button>

      {expanded && (
        <div className="border-t px-3 py-2">
          <div className="grid grid-cols-2 gap-4">
            <ItemList title={nameA} items={dimReportA?.items || []} />
            <ItemList title={nameB} items={dimReportB?.items || []} />
          </div>
        </div>
      )}
    </div>
  )
}

function ItemList({ title, items }: { title: string; items: RubricItemReport[] }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground mb-1">{title}</p>
      {items.map(item => (
        <div key={item.itemId} className="flex items-start gap-1.5 text-xs">
          <span className={`mt-0.5 shrink-0 ${
            item.result === 'pass' ? 'text-emerald-500' :
            item.result === 'fail' ? 'text-red-500' : 'text-muted-foreground'
          }`}>
            {item.result === 'pass' ? '✓' : item.result === 'fail' ? '✗' : '—'}
          </span>
          <span className="text-muted-foreground">{item.detail}</span>
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground italic">无检查项数据</p>
      )}
    </div>
  )
}

function ContentDiffView({
  diff,
  nameA,
  nameB,
}: {
  diff: ContentDiffLine[]
  nameA: string
  nameB: string
}) {
  if (diff.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        无法读取 SKILL.md 内容，无法展示 Diff
      </div>
    )
  }

  // Check if content is identical
  const hasChanges = diff.some(line => line.type !== 'same')
  if (!hasChanges) {
    return (
      <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        两个 SKILL.md 内容完全相同
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-red-100 dark:bg-red-900/40" />
          {nameA}（删除）
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-900/40" />
          {nameB}（新增）
        </span>
      </div>
      <div className="rounded-lg border overflow-hidden">
        <div className="max-h-[400px] overflow-y-auto">
          <pre className="text-xs leading-5 p-0 m-0">
            {diff.map((line, i) => (
              <div
                key={i}
                className={`px-3 py-0 font-mono whitespace-pre-wrap break-all ${
                  line.type === 'removed'
                    ? 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300'
                    : line.type === 'added'
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                    : ''
                }`}
              >
                <span className="inline-block w-4 text-muted-foreground select-none mr-2">
                  {line.type === 'removed' ? '-' : line.type === 'added' ? '+' : ' '}
                </span>
                {line.content}
              </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  )
}
