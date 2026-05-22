import { useEffect, useState, useCallback, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  LayoutDashboard,
  Loader2,
  Search,
  Sparkles,
  Trash2,
  Eye,
  Inbox,
  RefreshCw,
  Layers,
} from 'lucide-react'
import { toast } from 'sonner'
import { skillCardApi, type SkillCardSummary, type StoredSkillCard } from '@/api/client'
import CardPreview from '@/components/skills/CardPreview'
import { groupCardsBySkill, type SkillCardGroup } from '@/lib/cardGrouping'

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatVersionLabel(version: SkillCardSummary, isLatest: boolean): string {
  const d = new Date(version.generatedAt)
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return isLatest ? `最新 · ${time}` : time
}

export default function SkillCardsPage() {
  const [cards, setCards] = useState<SkillCardSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  // Preview dialog: opens against a *group*, then loads a specific version's
  // full card (with html). Switching versions re-fetches; payloads are small
  // (~50KB) so client-side caching isn't worth the complexity.
  const [previewGroup, setPreviewGroup] = useState<SkillCardGroup | null>(null)
  const [previewCard, setPreviewCard] = useState<StoredSkillCard | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Group-level deletion: confirm dialog warns about N versions.
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<SkillCardGroup | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { cards } = await skillCardApi.list()
      setCards(cards)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  // Re-load on mount, on navigation back to /cards, and on tab refocus
  // while we're on /cards.
  const location = useLocation()
  useEffect(() => {
    if (location.pathname !== '/cards') return
    void load()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [location.pathname, load])

  const groups = useMemo(() => groupCardsBySkill(cards), [cards])

  const filteredGroups = useMemo(() => {
    if (!query) return groups
    const q = query.toLowerCase()
    return groups.filter(g =>
      g.skillName.toLowerCase().includes(q) || g.latest.title.toLowerCase().includes(q),
    )
  }, [groups, query])

  const loadVersion = useCallback(async (id: string) => {
    setPreviewLoading(true)
    try {
      const { card } = await skillCardApi.get(id)
      setPreviewCard(card)
    } catch {
      toast.error('打开预览失败')
    } finally {
      setPreviewLoading(false)
    }
  }, [])

  const handleOpenPreview = (group: SkillCardGroup) => {
    setPreviewGroup(group)
    setPreviewCard(null)
    void loadVersion(group.latest.id)
  }

  const handleDeleteGroup = async () => {
    if (!pendingDeleteGroup) return
    const ids = pendingDeleteGroup.versions.map(v => v.id)
    try {
      // Sequential to keep error messages clean and to avoid hammering the
      // local-only server. 5-version cap means at most 5 round-trips.
      const results = await Promise.allSettled(ids.map(id => skillCardApi.delete(id)))
      const failed = results.filter(r => r.status === 'rejected').length
      const deleted = ids.length - failed
      if (deleted > 0) {
        toast.success(failed === 0 ? `已删除 ${deleted} 个版本` : `已删除 ${deleted} 个,${failed} 个失败`)
        setCards(prev => prev.filter(c => !ids.includes(c.id)))
        if (previewGroup?.skillPath === pendingDeleteGroup.skillPath) {
          setPreviewGroup(null)
          setPreviewCard(null)
        }
      } else {
        toast.error('删除失败')
      }
    } catch {
      toast.error('删除失败')
    } finally {
      setPendingDeleteGroup(null)
    }
  }

  const handleDeleteVersion = async (id: string) => {
    if (!previewGroup) return
    try {
      const { deleted } = await skillCardApi.delete(id)
      if (!deleted) {
        toast.error('卡片不存在或已被删除')
        return
      }
      toast.success('已删除该版本')

      // Update local state. If the group becomes empty after this deletion,
      // close the dialog. Otherwise, fall back to the new latest version.
      const remaining = previewGroup.versions.filter(v => v.id !== id)
      setCards(prev => prev.filter(c => c.id !== id))
      if (remaining.length === 0) {
        setPreviewGroup(null)
        setPreviewCard(null)
      } else {
        const updatedGroup: SkillCardGroup = {
          ...previewGroup,
          versions: remaining,
          latest: remaining[0],
        }
        setPreviewGroup(updatedGroup)
        if (previewCard?.id === id) {
          void loadVersion(remaining[0].id)
        }
      }
    } catch {
      toast.error('删除失败')
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <LayoutDashboard className="h-5 w-5 text-violet-600" />
          <h1 className="text-2xl font-semibold">卡片库</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          每个 Skill 一张代表卡(显示最新版本),点击预览可在同一 Skill 的历史版本之间切换。本地保存于 <code className="text-xs">~/.skills-manager/cards/</code>,每个 Skill 最多保留 5 个版本。
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="按 Skill 名 / 标题搜索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
          刷新
        </Button>
        <div className="ml-auto text-sm text-muted-foreground">
          共 {groups.length} 个 Skill · {cards.length} 张卡片{query && ` · 过滤后 ${filteredGroups.length} 个`}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && cards.length === 0 && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载中…
        </div>
      )}

      {!loading && filteredGroups.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
          <Inbox className="h-10 w-10 opacity-40" />
          <p className="text-sm">{query ? '没有匹配的 Skill' : '还没有生成过卡片'}</p>
          {!query && (
            <p className="text-xs">
              去 Skills 库,在 Skill 节点的下拉菜单选「生成可视化卡片」即可。
            </p>
          )}
        </div>
      )}

      {filteredGroups.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map(group => (
            <div
              key={group.skillPath}
              className="group border border-border rounded-lg p-4 bg-card hover:border-violet-300 dark:hover:border-violet-700 transition-colors flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate" title={group.skillName}>
                    {group.skillName}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1" title={group.latest.title}>
                    {group.latest.title}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {group.versions.length > 1 && (
                    <Badge
                      variant="outline"
                      className="text-[10px] gap-0.5 border-violet-200 text-violet-700 dark:border-violet-800 dark:text-violet-300"
                    >
                      <Layers className="h-2.5 w-2.5" />
                      {group.versions.length} 个版本
                    </Badge>
                  )}
                  {group.latest.hasRubric && (
                    <Badge className="text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                      已评测
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {group.latest.aiUsed && (
                  <span className="inline-flex items-center gap-0.5">
                    <Sparkles className="h-3 w-3 text-violet-500" />
                    AI
                  </span>
                )}
                <span>{formatTimestamp(group.latest.generatedAt)}</span>
              </div>

              <p className="text-[10px] text-muted-foreground truncate" title={group.skillPath}>
                {group.skillPath}
              </p>

              <div className="flex items-center gap-1 mt-auto pt-2 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 h-7 text-xs"
                  onClick={() => handleOpenPreview(group)}
                  disabled={previewLoading}
                >
                  <Eye className="mr-1 h-3 w-3" />
                  预览
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => setPendingDeleteGroup(group)}
                  title={group.versions.length > 1 ? `删除全部 ${group.versions.length} 个版本` : '删除'}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!previewGroup} onOpenChange={(o) => { if (!o) { setPreviewGroup(null); setPreviewCard(null) } }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] !flex !flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4 text-violet-600" />
              {previewGroup?.skillName}
              {previewGroup && previewGroup.versions.length > 1 && (
                <span className="text-xs font-normal text-muted-foreground">
                  · {previewGroup.versions.length} 个历史版本
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {previewCard
                ? `生成于 ${formatTimestamp(previewCard.generatedAt)} · ${previewCard.aiUsed ? 'AI 提炼' : '静态提取'}`
                : '加载中…'}
            </DialogDescription>
          </DialogHeader>

          {previewGroup && previewGroup.versions.length > 1 && (
            <div className="flex items-center gap-1 flex-wrap rounded-md border border-border bg-muted/30 p-1">
              {previewGroup.versions.map((v, idx) => {
                const isActive = previewCard?.id === v.id
                const isLatest = idx === 0
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => void loadVersion(v.id)}
                    disabled={previewLoading || isActive}
                    className={[
                      'inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors',
                      isActive
                        ? 'bg-background text-foreground shadow-sm border border-border'
                        : 'text-muted-foreground hover:bg-background/50 disabled:opacity-50',
                    ].join(' ')}
                    title={`切换到版本 · ${formatTimestamp(v.generatedAt)}`}
                  >
                    {v.aiUsed && <Sparkles className="h-3 w-3 text-violet-500" />}
                    {formatVersionLabel(v, isLatest)}
                    {isActive && (
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label="删除该版本"
                        title="删除该版本"
                        className="ml-1 -mr-0.5 inline-flex h-4 w-4 items-center justify-center rounded text-destructive hover:bg-destructive/10 cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); void handleDeleteVersion(v.id) }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); void handleDeleteVersion(v.id) } }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {previewLoading && !previewCard && (
            <div className="flex-1 min-h-0 flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              加载中…
            </div>
          )}

          {previewCard && (
            <CardPreview
              html={previewCard.html}
              fileName={`${previewCard.skillName}-card.html`}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDeleteGroup} onOpenChange={(o) => { if (!o) setPendingDeleteGroup(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDeleteGroup && pendingDeleteGroup.versions.length > 1
                ? `删除「${pendingDeleteGroup.skillName}」的全部 ${pendingDeleteGroup.versions.length} 个版本?`
                : `删除「${pendingDeleteGroup?.skillName ?? ''}」的卡片?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteGroup && pendingDeleteGroup.versions.length > 1
                ? `将一并删除该 Skill 在卡片库中保存的全部 ${pendingDeleteGroup.versions.length} 个历史版本。删除后无法恢复,后续仍可在 Skills 库下拉菜单重新生成。如果只想删除某一个版本,请关闭此弹窗,在「预览」对话框里点版本旁的删除按钮。`
                : '删除后无法恢复,后续仍可在 Skills 库下拉菜单重新生成。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteGroup()}>
              {pendingDeleteGroup && pendingDeleteGroup.versions.length > 1
                ? `确认删除 ${pendingDeleteGroup.versions.length} 个版本`
                : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
