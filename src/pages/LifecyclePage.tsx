import { useState, useEffect, useCallback, useMemo } from 'react'
import { useConfigStore } from '@/stores/configStore'
import { skillsApi, feedbackApi, freshApi, lifecycleApi } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  FileEdit,
  FlaskConical,
  Rocket,
  Activity,
  Wrench,
  Archive,
  RefreshCw,
  Loader2,
  ArrowRightLeft,
  BarChart3,
  MessageSquare,
} from 'lucide-react'
import { toast } from 'sonner'
import type { FileTreeNode } from '@/types'

// ==================== Types ====================

type LifecycleStage = 'draft' | 'evaluating' | 'published' | 'active' | 'needs_optimization' | 'archived'

interface SkillCard {
  name: string
  path: string
  stage: LifecycleStage
  qualityScore?: number
  qualityGrade?: string
  freshnessLevel?: 'fresh' | 'stale' | 'expired'
  feedbackCount?: number
  effectiveRate?: number
  lastModified?: string
  description?: string
}

// ==================== Constants ====================

const STAGES: { id: LifecycleStage; label: string; icon: typeof FileEdit; color: string; bgColor: string }[] = [
  { id: 'draft', label: '草稿', icon: FileEdit, color: 'text-slate-600', bgColor: 'bg-slate-100 dark:bg-slate-800' },
  { id: 'evaluating', label: '评测中', icon: FlaskConical, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950' },
  { id: 'published', label: '已发布', icon: Rocket, color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-950' },
  { id: 'active', label: '使用中', icon: Activity, color: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-950' },
  { id: 'needs_optimization', label: '待优化', icon: Wrench, color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950' },
  { id: 'archived', label: '已归档', icon: Archive, color: 'text-gray-500', bgColor: 'bg-gray-50 dark:bg-gray-800' },
]

const STAGE_CACHE_KEY = 'skill-lifecycle-stages'

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-green-500',
  B: 'bg-blue-500',
  C: 'bg-yellow-500',
  D: 'bg-orange-500',
  F: 'bg-red-500',
}

// ==================== Helpers ====================

/** Infer initial lifecycle stage from available data */
function inferStage(card: Omit<SkillCard, 'stage'>): LifecycleStage {
  // Expired freshness or very low quality → needs optimization
  if (card.freshnessLevel === 'expired') return 'needs_optimization'
  if (card.qualityScore !== undefined && card.qualityScore < 40) return 'needs_optimization'

  // Has feedback → actively being used
  if (card.feedbackCount && card.feedbackCount > 0) return 'active'

  // High quality → published
  if (card.qualityScore !== undefined && card.qualityScore >= 70) return 'published'

  // Medium quality → evaluating
  if (card.qualityScore !== undefined && card.qualityScore >= 40) return 'evaluating'

  // Default → draft
  return 'draft'
}

/** Collect valid skills from tree (top-level directories with isValidSkill) */
function collectValidSkills(tree: FileTreeNode[]): { name: string; path: string; description?: string }[] {
  return tree
    .filter(n => n.type === 'directory' && n.isValidSkill)
    .map(n => ({ name: n.name, path: n.path, description: n.description }))
}

// ==================== Component ====================

// Validate cached overrides — discard entries that don't match a known stage,
// in case localStorage was tampered with or schema evolved.
const VALID_STAGES = new Set<LifecycleStage>(STAGES.map(s => s.id))
function loadStageOverrides(): Record<string, LifecycleStage> {
  try {
    const cached = localStorage.getItem(STAGE_CACHE_KEY)
    if (!cached) return {}
    const parsed = JSON.parse(cached)
    if (!parsed || typeof parsed !== 'object') return {}
    const cleaned: Record<string, LifecycleStage> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k === 'string' && typeof v === 'string' && VALID_STAGES.has(v as LifecycleStage)) {
        cleaned[k] = v as LifecycleStage
      }
    }
    return cleaned
  } catch {
    return {}
  }
}

export default function LifecyclePage() {
  const { sourceDirs } = useConfigStore()

  // Raw skill data fetched from server — stage is derived later from overrides.
  type RawSkill = Omit<SkillCard, 'stage'>
  const [rawSkills, setRawSkills] = useState<RawSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSourceDirId, setSelectedSourceDirId] = useState<string>('')
  const [stageOverrides, setStageOverrides] = useState<Record<string, LifecycleStage>>(loadStageOverrides)

  // Load all data — only depends on sourceDir scope. stageOverrides are merged
  // in later via useMemo, so changing a card's stage never re-fetches.
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Get file tree — if "all", fetch each sourceDir and merge
      let validSkills: { name: string; path: string; description?: string }[] = []
      if (!selectedSourceDirId && sourceDirs.length > 1) {
        // Fetch all sourceDirs in parallel and merge
        const treeResults = await Promise.allSettled(
          sourceDirs.map(dir => skillsApi.getTree(dir.id))
        )
        for (const res of treeResults) {
          if (res.status === 'fulfilled') {
            validSkills.push(...collectValidSkills(res.value.tree))
          }
        }
      } else {
        const treeRes = await skillsApi.getTree(selectedSourceDirId || undefined)
        validSkills = collectValidSkills(treeRes.tree)
      }
      if (validSkills.length === 0) {
        setRawSkills([])
        setLoading(false)
        return
      }

      // 2. Parallel fetch: freshness + feedback stats
      const skillPaths = validSkills.map(s => s.path)
      const [freshnessRes, feedbackStatsRes] = await Promise.allSettled([
        freshApi.batchCheck(skillPaths),
        feedbackApi.getStats(),
      ])

      // Build lookup maps
      const freshnessMap: Record<string, 'fresh' | 'stale' | 'expired'> = {}
      if (freshnessRes.status === 'fulfilled') {
        for (const r of freshnessRes.value.reports) {
          freshnessMap[r.skillPath] = r.level
        }
      }

      const feedbackMap: Record<string, { total: number; effectiveRate: number }> = {}
      if (feedbackStatsRes.status === 'fulfilled') {
        for (const s of feedbackStatsRes.value.stats) {
          feedbackMap[s.skillPath] = {
            total: s.total,
            effectiveRate: s.total > 0 ? s.effective / s.total : 0,
          }
        }
      }

      // 3. Try batch Rubric (may not have cached results, so we fetch fresh)
      const rubricMap: Record<string, { score: number; grade: string }> = {}
      try {
        const data = await lifecycleApi.batchRubric()
        for (const r of (data.reports || [])) {
          rubricMap[r.skillPath] = { score: r.score, grade: r.grade }
        }
      } catch { /* silent */ }

      // 4. Build raw skill records (no stage yet — merged later)
      const next: RawSkill[] = validSkills.map(skill => {
        const rubric = rubricMap[skill.path]
        const feedback = feedbackMap[skill.path]
        const freshness = freshnessMap[skill.path]
        return {
          name: skill.name,
          path: skill.path,
          description: skill.description,
          qualityScore: rubric?.score,
          qualityGrade: rubric?.grade,
          freshnessLevel: freshness,
          feedbackCount: feedback?.total,
          effectiveRate: feedback?.effectiveRate,
        }
      })

      setRawSkills(next)
    } catch (e) {
      toast.error(`加载失败：${e instanceof Error ? e.message : '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }, [selectedSourceDirId, sourceDirs])

  useEffect(() => { loadData() }, [loadData])

  // Change stage — only mutates stageOverrides; the visible `skills` list
  // recomputes via useMemo on the next render.
  const handleStageChange = useCallback((skillPath: string, newStage: LifecycleStage) => {
    setStageOverrides(prev => {
      const updated = { ...prev, [skillPath]: newStage }
      try { localStorage.setItem(STAGE_CACHE_KEY, JSON.stringify(updated)) } catch { /* ignore */ }
      return updated
    })
    const stageLabel = STAGES.find(s => s.id === newStage)?.label || newStage
    toast.success(`已切换到「${stageLabel}」`)
  }, [])

  // Final cards: raw data + stage override or inferred stage. This is the
  // join point that previously sat inside loadData and caused re-fetches.
  const skills = useMemo<SkillCard[]>(
    () =>
      rawSkills.map(raw => ({
        ...raw,
        stage: stageOverrides[raw.path] || inferStage(raw),
      })),
    [rawSkills, stageOverrides],
  )

  // Group skills by stage
  const grouped = useMemo(() => {
    const map: Record<LifecycleStage, SkillCard[]> = {
      draft: [], evaluating: [], published: [], active: [], needs_optimization: [], archived: [],
    }
    for (const s of skills) {
      map[s.stage].push(s)
    }
    return map
  }, [skills])

  // Stage summary stats
  const { totalSkills, avgScore } = useMemo(() => {
    const scored = skills.filter(s => s.qualityScore !== undefined)
    return {
      totalSkills: skills.length,
      avgScore: scored.length > 0
        ? Math.round(scored.reduce((sum, s) => sum + (s.qualityScore || 0), 0) / scored.length)
        : null,
    }
  }, [skills])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">生命周期看板</h2>
          <p className="text-sm text-muted-foreground mt-1">
            管理 Skill 从创建到归档的完整生命周期
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Skills 库选择器 */}
          {sourceDirs.length > 0 && (
            <select
              aria-label="选择 Skills 库"
              value={selectedSourceDirId}
              onChange={e => setSelectedSourceDirId(e.target.value)}
              className="rounded-lg border bg-background px-3 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">全部 Skills 库</option>
              {sourceDirs.map(dir => (
                <option key={dir.id} value={dir.id}>{dir.name || dir.path}</option>
              ))}
            </select>
          )}
          {totalSkills > 0 && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground mr-2">
              <span>{totalSkills} 个 Skill</span>
              {avgScore !== null && <span>平均质量分 {avgScore}</span>}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
            刷新
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {loading && skills.length === 0 && (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          正在加载数据...
        </div>
      )}

      {/* Empty state */}
      {!loading && skills.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Archive className="h-12 w-12 mb-3 opacity-50" />
          <p className="text-lg font-medium">暂无 Skill</p>
          <p className="text-sm">请先在 Skills 库中添加源目录并创建 Skill</p>
        </div>
      )}

      {/* Kanban board */}
      {skills.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {STAGES.map(stage => {
            const stageSkills = grouped[stage.id]
            const Icon = stage.icon
            return (
              <div key={stage.id} className="flex flex-col min-h-[200px]">
                {/* Column header */}
                <div className={cn('flex items-center gap-2 px-3 py-2 rounded-t-lg', stage.bgColor)}>
                  <Icon className={cn('h-4 w-4', stage.color)} />
                  <span className={cn('text-sm font-medium', stage.color)}>{stage.label}</span>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {stageSkills.length}
                  </Badge>
                </div>

                {/* Cards */}
                <div className="flex-1 space-y-2 p-2 bg-muted/20 rounded-b-lg border border-t-0 min-h-[150px]">
                  {stageSkills.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">暂无</p>
                  )}
                  {stageSkills.map(skill => (
                    <SkillCardItem
                      key={skill.path}
                      skill={skill}
                      onStageChange={handleStageChange}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ==================== Skill Card Component ====================

function SkillCardItem({
  skill,
  onStageChange,
}: {
  skill: SkillCard
  onStageChange: (path: string, stage: LifecycleStage) => void
}) {
  const freshnessConfig = {
    fresh: { color: 'bg-green-500', label: '良好' },
    stale: { color: 'bg-yellow-500', label: '需关注' },
    expired: { color: 'bg-red-500', label: '已过期' },
  }

  return (
    <Card className="shadow-sm">
      <CardContent className="p-3 space-y-2">
        {/* Name + grade badge */}
        <div className="flex items-start justify-between gap-1">
          <span className="text-sm font-medium truncate flex-1" title={skill.name}>
            {skill.name}
          </span>
          {skill.qualityGrade && (
            <Badge className={cn('text-[10px] px-1.5 py-0 text-white shrink-0', GRADE_COLORS[skill.qualityGrade] || 'bg-gray-400')}>
              {skill.qualityGrade}
            </Badge>
          )}
        </div>

        {/* Metrics row */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
          {skill.qualityScore !== undefined && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-0.5">
                  <BarChart3 className="h-3 w-3" />
                  {skill.qualityScore}
                </span>
              </TooltipTrigger>
              <TooltipContent><p>质量分</p></TooltipContent>
            </Tooltip>
          )}

          {skill.feedbackCount !== undefined && skill.feedbackCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-0.5">
                  <MessageSquare className="h-3 w-3" />
                  {skill.feedbackCount}
                </span>
              </TooltipTrigger>
              <TooltipContent><p>反馈数</p></TooltipContent>
            </Tooltip>
          )}

          {skill.freshnessLevel && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn('inline-block w-2 h-2 rounded-full', freshnessConfig[skill.freshnessLevel].color)} />
              </TooltipTrigger>
              <TooltipContent><p>保鲜度：{freshnessConfig[skill.freshnessLevel].label}</p></TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Stage changer */}
        <Select value={skill.stage} onValueChange={(v) => onStageChange(skill.path, v as LifecycleStage)}>
          <SelectTrigger className="h-6 text-[11px]">
            <div className="flex items-center gap-1">
              <ArrowRightLeft className="h-3 w-3" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {STAGES.map(s => (
              <SelectItem key={s.id} value={s.id} className="text-xs">
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  )
}
