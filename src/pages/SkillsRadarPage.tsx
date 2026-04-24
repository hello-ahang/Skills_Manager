import { useEffect, useState } from 'react'
import { useRadarStore, type RadarSkillItem, type RadarSearchResult, type RadarCategory, type RadarSkillSource } from '@/stores/radarStore'
import { useConfigStore } from '@/stores/configStore'
import { ScrollArea } from '@/components/ui/scroll-area'
import SandboxPanel from '@/components/skills/SandboxPanel'
import {
  Loader2,
  Search,
  Sparkles,
  Tags,
  ChevronDown,
  ChevronRight,
  Library,
  FolderOpen,
  History,
  Filter,
  RefreshCw,
  AlertCircle,
  Radar,
  PlayCircle,
} from 'lucide-react'

// ==================== Source Badge ====================

function SourceBadge({ source, sourceName }: { source: string; sourceName: string }) {
  const config: Record<string, { icon: typeof Library; color: string }> = {
    library: { icon: Library, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    project: { icon: FolderOpen, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    'import-history': { icon: History, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  }
  const { icon: Icon, color } = config[source] || config.library
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {sourceName}
    </span>
  )
}

// ==================== Tag Badge ====================

function TagBadge({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
      {tag}
    </span>
  )
}

// ==================== AI Search Section ====================

function AISearchSection() {
  const { searchQuery, searchResults, searching, searchError, skills, aiSearch, clearSearch } = useRadarStore()
  const { llmModels, defaultModelId } = useConfigStore()
  const [input, setInput] = useState('')
  const [searchTab, setSearchTab] = useState<'library' | 'clawhub'>('library')
  const defaultModel = llmModels.find(m => m.id === defaultModelId && m.tested)
    || llmModels.find(m => m.tested)
    || null
  const hasModel = !!defaultModel

  const handleSearch = () => {
    if (!input.trim()) return
    aiSearch(input.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSearch()
    }
  }

  // Find full skill info for search results
  const enrichedResults = searchResults.map(r => {
    const skill = skills.find(s => s.name === r.name)
    return { ...r, skill }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Radar className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">AI 智能检索</h2>
        <span className="text-xs text-muted-foreground">场景搜索 / ClawHub 检索</span>
      </div>

      {/* Search scope tabs */}
      <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1 w-fit">
        <button
          onClick={() => setSearchTab('library')}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            searchTab === 'library'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          场景搜索
        </button>
        <button
          onClick={() => {
            alert('ClawHub 检索功能正在开发中，敬请期待！')
          }}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground/50 cursor-not-allowed"
          title="功能开发中，敬请期待"
        >
          ClawHub 检索
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述你的使用场景，如：帮我做代码审查、旅行规划、生成 PPT..."
            className="h-10 w-full rounded-lg border bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={!input.trim() || searching || !hasModel}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          AI 搜索
        </button>
        {searchQuery && (
          <button
            onClick={() => { clearSearch(); setInput('') }}
            className="inline-flex h-10 items-center rounded-lg border px-3 text-sm text-muted-foreground hover:bg-accent"
          >
            清除
          </button>
        )}
      </div>

      {!hasModel && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          请先在右上角「模型配置」中添加模型、测试通过并设置默认使用模型
        </div>
      )}
      {hasModel && (
        <p className="text-xs text-muted-foreground">
          当前使用模型：<strong>{defaultModel!.displayName}</strong>（{defaultModel!.modelName}）
        </p>
      )}

      {searchError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {searchError}
        </div>
      )}

      {enrichedResults.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            找到 <strong>{enrichedResults.length}</strong> 个匹配的 Skill（场景：{searchQuery}）
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {enrichedResults.map((r, i) => (
              <div key={i} className="rounded-lg border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-sm">{r.name}</h3>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {Math.round(r.score * 100)}%
                  </span>
                </div>
                {r.skill?.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{r.skill.description}</p>
                )}
                <p className="text-xs text-primary/80 italic">"{r.reason}"</p>
                {r.skill && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <SourceBadge source={r.skill.source} sourceName={r.skill.sourceName} />
                    {r.skill.tags?.map(t => <TagBadge key={t} tag={t} />)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {searchQuery && !searching && enrichedResults.length === 0 && !searchError && (
        <p className="text-sm text-muted-foreground">未找到匹配的 Skill，试试换个描述方式？</p>
      )}
    </div>
  )
}

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
          onClick={generateSummary}
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
  const { skills, tags, tagging, tagError, generateTags, sourceFilter, tagFilter, setSourceFilter, setTagFilter } = useRadarStore()
  const { llmModels, defaultModelId } = useConfigStore()
  const defaultModel = llmModels.find(m => m.id === defaultModelId && m.tested)
    || llmModels.find(m => m.tested)
    || null
  const hasModel = !!defaultModel

  const [searchText, setSearchText] = useState('')

  // Collect all unique sources and tags for filters
  const allSources = Array.from(new Set(skills.map(s => s.source)))
  const allTags = Array.from(new Set(skills.flatMap(s => s.tags || [])))

  // Apply filters + search
  const filtered = skills.filter(s => {
    if (sourceFilter !== 'all' && s.source !== sourceFilter) return false
    if (tagFilter !== 'all' && !(s.tags || []).includes(tagFilter)) return false
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
              <col className="w-[45%]" />
              <col className="w-[20%]" />
              <col className="w-[25%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
              <tr className="border-b">
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground">名称 / 描述</th>
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground">来源</th>
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground">标签</th>
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground">版本</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
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
    </div>
  )
}

// ==================== Main Page ====================

type RadarTopTab = 'overview' | 'sandbox'

export default function SkillsRadarPage() {
  const { skills, loading, error, fetchSkills } = useRadarStore()
  const [topTab, setTopTab] = useState<RadarTopTab>('overview')

  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

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
            onClick={fetchSkills}
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
          <button
            onClick={fetchSkills}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            刷新数据
          </button>
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
