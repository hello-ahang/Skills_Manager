import { useEffect, useState } from 'react'
import { useRadarStore, type RadarSkillItem, type RadarSearchResult, type RadarCategory, type RadarSkillSource } from '@/stores/radarStore'
import { useConfigStore } from '@/stores/configStore'
import { ScrollArea } from '@/components/ui/scroll-area'
import SandboxPanel from '@/components/skills/SandboxPanel'
import { toast } from 'sonner'
import {
  Loader2,
  Search,
  Sparkles,
  Tags,
  ChevronDown,
  ChevronRight,
  Filter,
  RefreshCw,
  AlertCircle,
  Radar,
  PlayCircle,
  TrendingUp,
  GitCompareArrows,
} from 'lucide-react'
import SkillComparePanel from '@/components/skills/SkillComparePanel'
import AISearchSection from '@/components/radar/AISearchSection'
import { SourceBadge, TagBadge, GradeBadge } from '@/components/radar/badges'


// ==================== Summary Section ====================

function SummarySection() {
  const { skills, summary, summarizing, summaryError, generateSummary } = useRadarStore()
  const { llmModels, defaultModelId } = useConfigStore()
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const defaultModel = llmModels.find(m => m.id === defaultModelId && m.tested)
    || llmModels.find(m => m.tested)
    || null
  const hasModel = !!defaultModel

  const toggleCategory = (name: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">能力总览</h2>
          <span className="text-xs text-muted-foreground">AI 分析所有 Skills 的能力分布</span>
        </div>
        <button
          onClick={() => generateSummary()}
          disabled={summarizing || skills.length === 0 || !hasModel}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {summarizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {summary ? '重新生成' : '生成能力总览'}
        </button>
      </div>

      {summaryError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {summaryError}
        </div>
      )}

      {summarizing && (
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">AI 正在分析 {skills.length} 个 Skills...</span>
        </div>
      )}

      {summary && !summarizing && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-primary/5 px-4 py-3">
            <p className="text-sm">
              <strong>共 {summary.totalCount} 个 Skills</strong>，分为 {summary.categories.length} 个类别。{summary.summary}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {summary.categories.map((cat: RadarCategory) => {
              const isExpanded = expandedCategories.has(cat.name)
              return (
                <div key={cat.name} className="rounded-lg border bg-card">
                  <button
                    onClick={() => toggleCategory(cat.name)}
                    className="flex w-full items-center justify-between p-3 text-left hover:bg-accent/50 rounded-lg"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{cat.name}</span>
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                          {cat.count}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1" title={cat.description}>{cat.description}</p>
                    </div>
                    {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  </button>
                  {isExpanded && (
                    <div className="border-t px-3 py-2 space-y-1">
                      {cat.skills.map(name => {
                        const skill = skills.find(s => s.name === name)
                        return (
                          <div
                            key={name}
                            className="flex items-center gap-2 text-xs py-0.5"
                            title={skill?.description || ''}
                          >
                            <span className="font-medium">{name}</span>
                            {skill && <SourceBadge source={skill.source} sourceName={skill.sourceName} />}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!summary && !summarizing && !summaryError && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-muted-foreground">
          <Sparkles className="h-8 w-8 opacity-30" />
          <p className="text-sm">点击"生成能力总览"让 AI 分析你的 Skills 能力分布</p>
        </div>
      )}
    </div>
  )
}

// ==================== Skills List Section ====================

function SkillsListSection() {
  const { skills, tags, tagging, tagError, generateTags, sourceFilter, tagFilter, gradeFilter, setSourceFilter, setTagFilter, setGradeFilter } = useRadarStore()
  const { llmModels, defaultModelId } = useConfigStore()
  const defaultModel = llmModels.find(m => m.id === defaultModelId && m.tested)
    || llmModels.find(m => m.tested)
    || null
  const hasModel = !!defaultModel

  const [searchText, setSearchText] = useState('')
  const [showCompare, setShowCompare] = useState(false)

  // Collect all unique sources, tags, and grades for filters
  const allSources = Array.from(new Set(skills.map(s => s.source)))
  const allTags = Array.from(new Set(skills.flatMap(s => s.tags || [])))
  const allGrades = (['A', 'B', 'C', 'D', 'F'] as const).filter(g => skills.some(s => s.rubricGrade === g))
  const hasAnyGrade = skills.some(s => s.rubricGrade)

  // Apply filters + search
  const filtered = skills.filter(s => {
    if (sourceFilter !== 'all' && s.source !== sourceFilter) return false
    if (tagFilter !== 'all' && !(s.tags || []).includes(tagFilter)) return false
    if (gradeFilter !== 'all') {
      if (gradeFilter === 'unrated') {
        if (s.rubricGrade) return false
      } else if (s.rubricGrade !== gradeFilter) {
        return false
      }
    }
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase()
      const nameMatch = s.name.toLowerCase().includes(q)
      const descMatch = (s.description || '').toLowerCase().includes(q)
      const tagMatch = (s.tags || []).some(t => t.toLowerCase().includes(q))
      if (!nameMatch && !descMatch && !tagMatch) return false
    }
    return true
  })

  // Count untagged
  const untaggedCount = skills.filter(s => !s.tags || s.tags.length === 0).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Library className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Skills 全景</h2>
          <span className="text-xs text-muted-foreground">共 {skills.length} 个 Skills</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜索名称、描述、标签..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              className="h-8 w-48 rounded-md border bg-background pl-7 pr-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Source filter */}
          <div className="flex items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">全部来源</option>
              {allSources.map(s => (
                <option key={s} value={s}>
                  {s === 'library' ? 'Skills 库' : s === 'project' ? '项目' : '导入历史'}
                </option>
              ))}
            </select>
          </div>

          {/* Tag filter */}
          {allTags.length > 0 && (
            <select
              value={tagFilter}
              onChange={e => setTagFilter(e.target.value)}
              className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">全部标签</option>
              {allTags.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}

          {/* Grade filter */}
          {hasAnyGrade && (
            <div className="flex items-center gap-1">
              <Award className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={gradeFilter}
                onChange={e => setGradeFilter(e.target.value)}
                className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">全部等级</option>
                {allGrades.map(g => (
                  <option key={g} value={g}>{g} 级</option>
                ))}
                <option value="unrated">未评测</option>
              </select>
            </div>
          )}

          {/* AI generate tags button */}
          <button
            onClick={generateTags}
            disabled={tagging || skills.length === 0 || !hasModel || untaggedCount === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            title={untaggedCount === 0 ? '所有 Skills 已有标签' : `为 ${untaggedCount} 个 Skills 生成标签`}
          >
            {tagging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Tags className="h-3.5 w-3.5" />}
            {tagging ? '生成中...' : untaggedCount > 0 ? `AI 生成标签 (${untaggedCount})` : '标签已生成'}
          </button>

          {/* Compare button */}
          <button
            onClick={() => setShowCompare(true)}
            disabled={skills.filter(s => s.path).length < 2}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 px-3 py-1.5 text-xs font-medium text-violet-600 hover:bg-violet-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-violet-800 dark:text-violet-400 dark:hover:bg-violet-950"
            title="选择两个 Skill 进行 Rubric 对比评测"
          >
            <GitCompareArrows className="h-3.5 w-3.5" />
            对比评测
          </button>
        </div>
      </div>

      {tagError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {tagError}
        </div>
      )}

      {/* Skills table */}
      <div className="rounded-lg border overflow-hidden">
        <div className="max-h-[500px] overflow-y-auto">
          <table className="w-full text-left table-fixed">
            <colgroup>
              <col className="w-[35%]" />
              <col className="w-[15%]" />
              <col className="w-[20%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
              <tr className="border-b">
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground">名称 / 描述</th>
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground">来源</th>
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground">标签</th>
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground">质量</th>
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground">使用次数</th>
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground">版本</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {skills.length === 0 ? '暂无 Skills 数据' : '没有匹配的 Skills'}
                  </td>
                </tr>
              ) : (
                filtered.map((skill, i) => (
                  <tr
                    key={`${skill.name}-${skill.source}-${i}`}
                    className="border-b last:border-0 hover:bg-accent/30"
                  >
                    <td className="px-4 py-2.5">
                      <p className="text-sm font-medium truncate" title={skill.name}>{skill.name}</p>
                      {skill.description && (
                        <p className="text-xs text-muted-foreground truncate" title={skill.description}>{skill.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        {skill.sources && skill.sources.length > 1
                          ? skill.sources.map((s, idx) => (
                              <SourceBadge key={`${s.source}-${s.sourceName}-${idx}`} source={s.source} sourceName={s.sourceName} />
                            ))
                          : <SourceBadge source={skill.source} sourceName={skill.sourceName} />
                        }
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        {skill.tags?.map(t => <TagBadge key={t} tag={t} />) || (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {skill.rubricGrade
                        ? <GradeBadge grade={skill.rubricGrade} score={skill.rubricScore} />
                        : <span className="text-xs text-muted-foreground">—</span>
                      }
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-muted-foreground">
                        {(skill.usageCount ?? 0) > 0 ? skill.usageCount : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-muted-foreground">
                        {skill.version ? `v${skill.version}` : '—'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Skill Compare Panel */}
      <SkillComparePanel
        open={showCompare}
        onOpenChange={setShowCompare}
        skills={skills.filter(s => s.path).map(s => ({ name: s.name, path: s.path! }))}
      />
    </div>
  )
}

// ==================== Main Page ====================

type RadarTopTab = 'overview' | 'sandbox'

export default function SkillsRadarPage() {
  const { skills, loading, error, fetchSkills } = useRadarStore()
  const { sourceDirs } = useConfigStore()
  const [topTab, setTopTab] = useState<RadarTopTab>('overview')
  const [selectedSourceDirId, setSelectedSourceDirId] = useState<string>('')

  useEffect(() => {
    fetchSkills(selectedSourceDirId || undefined)
  }, [fetchSkills, selectedSourceDirId])

  const handleSourceDirChange = (dirId: string) => {
    setSelectedSourceDirId(dirId)
  }

  if (loading && skills.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">正在聚合 Skills 数据...</span>
        </div>
      </div>
    )
  }

  if (error && skills.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-destructive">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm">{error}</p>
          <button
            onClick={() => fetchSkills(selectedSourceDirId || undefined)}
            className="mt-2 inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs hover:bg-accent"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重试
          </button>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-5xl space-y-8 p-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Radar className="h-6 w-6 text-primary" />
              Skills 雷达
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              通过 AI 实现 Skills 智能检索、能力总览和自动标签分类，解决资产不透明和场景匹配困难的痛点
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Skills 库选择器 */}
            {sourceDirs.length > 0 && (
              <select
                value={selectedSourceDirId}
                onChange={e => handleSourceDirChange(e.target.value)}
                className="rounded-lg border bg-background px-3 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">全部 Skills 库</option>
                {sourceDirs.map(dir => (
                  <option key={dir.id} value={dir.id}>{dir.name || dir.path}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => fetchSkills(selectedSourceDirId || undefined)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              刷新数据
            </button>
          </div>
        </div>

        {/* Top tab switcher - Large Segment Control (主导航) */}
        <div className="inline-flex items-center gap-1 rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/10 p-1.5 shadow-md">
          <button
            onClick={() => setTopTab('overview')}
            className={`inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold transition-all duration-200 ${
              topTab === 'overview'
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-[1.03]'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
            }`}
          >
            <Radar className="h-4 w-4" />
            雷达概览
          </button>
          <button
            onClick={() => setTopTab('sandbox')}
            className={`inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold transition-all duration-200 ${
              topTab === 'sandbox'
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-[1.03]'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
            }`}
          >
            <PlayCircle className="h-4 w-4" />
            测试沙箱
          </button>
        </div>

        {topTab === 'overview' && (
          <>
            {/* AI Search */}
            <AISearchSection />

            <hr className="border-border" />

            {/* Summary */}
            <SummarySection />

            <hr className="border-border" />

            {/* Skills List */}
            <SkillsListSection />
          </>
        )}

        {topTab === 'sandbox' && (
          <SandboxPanel />
        )}
      </div>
    </ScrollArea>
  )
}
