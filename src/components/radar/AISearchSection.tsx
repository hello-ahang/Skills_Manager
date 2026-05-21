import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  Download,
  ExternalLink,
  Loader2,
  Radar,
  Search,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { useRadarStore } from '@/stores/radarStore'
import { useConfigStore } from '@/stores/configStore'
import { importApi } from '@/api/client'
import { SourceBadge, TagBadge, GradeBadge } from './badges'

interface ClawHubScanSkill {
  name: string
  description?: string
  path?: string
}

interface ClawHubScanRepoInfo {
  name?: string
  url?: string
  branch?: string
}

interface ClawHubScanResult {
  skills: ClawHubScanSkill[]
  repoInfo: ClawHubScanRepoInfo
}

export default function AISearchSection() {
  const { searchQuery, searchResults, searching, searchError, skills, aiSearch, clearSearch } = useRadarStore()
  const { llmModels, defaultModelId } = useConfigStore()
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [searchTab, setSearchTab] = useState<'library' | 'clawhub'>('library')
  const [clawhubUrl, setClawhubUrl] = useState('')
  const [clawhubBranch, setClawhubBranch] = useState('')
  const [clawhubScanning, setClawhubScanning] = useState(false)
  const [clawhubResults, setClawhubResults] = useState<ClawHubScanResult | null>(null)
  const [clawhubError, setClawhubError] = useState<string | null>(null)

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

  const handleClawhubScan = async () => {
    const url = clawhubUrl.trim()
    if (!url) return
    setClawhubScanning(true)
    setClawhubError(null)
    setClawhubResults(null)
    try {
      const branch = clawhubBranch.trim() || undefined
      const result = await importApi.scanClawHub(url, branch) as ClawHubScanResult
      setClawhubResults(result)
      if (!result.skills?.length) {
        setClawhubError('该仓库未发现可识别的 Skills（应包含 SKILL.md 的目录）')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '扫描失败'
      setClawhubError(message)
    } finally {
      setClawhubScanning(false)
    }
  }

  const handleClawhubKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleClawhubScan()
    }
  }

  const goToImport = () => {
    if (clawhubUrl.trim()) {
      const params = new URLSearchParams()
      params.set('source', 'clawhub')
      params.set('url', clawhubUrl.trim())
      if (clawhubBranch.trim()) params.set('branch', clawhubBranch.trim())
      navigate(`/import?${params.toString()}`)
    } else {
      navigate('/import')
      toast.info('请在导入中心选择 ClawHub 源完成导入')
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
          onClick={() => setSearchTab('clawhub')}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            searchTab === 'clawhub'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          ClawHub 检索
        </button>
      </div>

      {searchTab === 'library' && (
        <>
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
                      <div className="flex items-center gap-1.5 shrink-0">
                        {r.rubricGrade && <GradeBadge grade={r.rubricGrade} score={r.rubricScore} />}
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary" title="语义匹配度">
                          {Math.round(r.score * 100)}%
                        </span>
                      </div>
                    </div>
                    {r.skill?.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{r.skill.description}</p>
                    )}
                    <p className="text-xs text-primary/80 italic">"{r.reason}"</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {r.skill && <SourceBadge source={r.skill.source} sourceName={r.skill.sourceName} />}
                      {r.skill?.tags?.map(t => <TagBadge key={t} tag={t} />)}
                      {(r.usageCount ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="使用次数">
                          <TrendingUp className="h-3 w-3" />
                          {r.usageCount}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {searchQuery && !searching && enrichedResults.length === 0 && !searchError && (
            <p className="text-sm text-muted-foreground">未找到匹配的 Skill，试试换个描述方式？</p>
          )}
        </>
      )}

      {searchTab === 'clawhub' && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            输入 ClawHub 公开仓库地址扫描其中包含的 Skills，并跳转到导入中心完成导入。
          </p>
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[280px]">
              <ExternalLink className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={clawhubUrl}
                onChange={e => setClawhubUrl(e.target.value)}
                onKeyDown={handleClawhubKeyDown}
                placeholder="https://clawhub.io/<owner>/<repo>"
                className="h-10 w-full rounded-lg border bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <input
              type="text"
              value={clawhubBranch}
              onChange={e => setClawhubBranch(e.target.value)}
              onKeyDown={handleClawhubKeyDown}
              placeholder="分支（可选，默认 main）"
              className="h-10 w-44 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              onClick={handleClawhubScan}
              disabled={!clawhubUrl.trim() || clawhubScanning}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {clawhubScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              扫描
            </button>
            <button
              onClick={goToImport}
              className="inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm hover:bg-accent"
            >
              <Download className="h-4 w-4" />
              去导入中心
            </button>
          </div>

          {clawhubError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {clawhubError}
            </div>
          )}

          {clawhubResults?.skills && clawhubResults.skills.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                找到 <strong>{clawhubResults.skills.length}</strong> 个 Skill
                {clawhubResults.repoInfo?.name ? `（${clawhubResults.repoInfo.name}）` : ''}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {clawhubResults.skills.map((s, i) => (
                  <div key={i} className="rounded-lg border bg-card p-4 space-y-1">
                    <h3 className="font-medium text-sm">{s.name}</h3>
                    {s.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>
                    )}
                    {s.path && (
                      <p className="text-[11px] text-muted-foreground/80 truncate">{s.path}</p>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={goToImport}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Download className="h-4 w-4" />
                前往导入中心完成导入
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
