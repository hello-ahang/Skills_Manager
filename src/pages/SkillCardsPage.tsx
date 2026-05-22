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
} from 'lucide-react'
import { toast } from 'sonner'
import { skillCardApi, type SkillCardSummary, type StoredSkillCard } from '@/api/client'
import CardPreview from '@/components/skills/CardPreview'

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function SkillCardsPage() {
  const [cards, setCards] = useState<SkillCardSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const [preview, setPreview] = useState<StoredSkillCard | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

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
  // while we're on /cards. Single effect: split mount/location watchers
  // both fire on initial render and double-fetch.
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

  const handlePreview = async (id: string) => {
    setPreviewLoading(true)
    try {
      const { card } = await skillCardApi.get(id)
      setPreview(card)
    } catch {
      toast.error('打开预览失败')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!pendingDeleteId) return
    try {
      const { deleted } = await skillCardApi.delete(pendingDeleteId)
      if (deleted) {
        toast.success('已删除卡片')
        setCards(prev => prev.filter(c => c.id !== pendingDeleteId))
        if (preview?.id === pendingDeleteId) setPreview(null)
      } else {
        toast.error('卡片不存在或已被删除')
      }
    } catch {
      toast.error('删除失败')
    } finally {
      setPendingDeleteId(null)
    }
  }

  const filtered = useMemo(() => {
    if (!query) return cards
    const q = query.toLowerCase()
    return cards.filter(c =>
      c.skillName.toLowerCase().includes(q) || c.title.toLowerCase().includes(q),
    )
  }, [cards, query])

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <LayoutDashboard className="h-5 w-5 text-violet-600" />
          <h1 className="text-2xl font-semibold">卡片库</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          所有为 Skill 生成过的可视化卡片都自动保存在本地 <code className="text-xs">~/.skills-manager/cards/</code>。每个 Skill 保留最近 5 个版本,新生成会自动覆盖旧版。
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
          共 {cards.length} 张{query && ` · 过滤后 ${filtered.length}`}
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

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
          <Inbox className="h-10 w-10 opacity-40" />
          <p className="text-sm">{query ? '没有匹配的卡片' : '还没有生成过卡片'}</p>
          {!query && (
            <p className="text-xs">
              去 Skills 库,在 Skill 节点的下拉菜单选「生成可视化卡片」即可。
            </p>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(card => (
            <div
              key={card.id}
              className="group border border-border rounded-lg p-4 bg-card hover:border-violet-300 dark:hover:border-violet-700 transition-colors flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate" title={card.skillName}>
                    {card.skillName}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1" title={card.title}>
                    {card.title}
                  </p>
                </div>
                {card.hasRubric && (
                  <Badge className="shrink-0 text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                    已评测
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {card.aiUsed && (
                  <span className="inline-flex items-center gap-0.5">
                    <Sparkles className="h-3 w-3 text-violet-500" />
                    AI
                  </span>
                )}
                <span>{formatTimestamp(card.generatedAt)}</span>
              </div>

              <p className="text-[10px] text-muted-foreground truncate" title={card.skillPath}>
                {card.skillPath}
              </p>

              <div className="flex items-center gap-1 mt-auto pt-2 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 h-7 text-xs"
                  onClick={() => void handlePreview(card.id)}
                  disabled={previewLoading}
                >
                  <Eye className="mr-1 h-3 w-3" />
                  预览
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => setPendingDeleteId(card.id)}
                  title="删除"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => { if (!o) setPreview(null) }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] !flex !flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4 text-violet-600" />
              {preview?.skillName}
            </DialogTitle>
            <DialogDescription>
              {preview && `生成于 ${formatTimestamp(preview.generatedAt)} · ${preview.aiUsed ? 'AI 提炼' : '静态提取'}`}
            </DialogDescription>
          </DialogHeader>

          {preview && (
            <CardPreview
              html={preview.html}
              fileName={`${preview.skillName}-card.html`}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDeleteId} onOpenChange={(o) => { if (!o) setPendingDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这张卡片?</AlertDialogTitle>
            <AlertDialogDescription>
              删除后无法恢复。同 Skill 的其他历史版本不受影响,后续仍可在 Skills 库下拉菜单重新生成。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
