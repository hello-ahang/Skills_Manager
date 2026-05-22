import { useEffect, useState, useCallback } from 'react'
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
  DialogFooter,
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
  Download,
  Copy,
  ExternalLink,
  Inbox,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { skillCardApi, type SkillCardSummary, type StoredSkillCard } from '@/api/client'

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const GRADE_COLORS: Record<string, string> = {
  A: 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-950/50',
  B: 'text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-950/50',
  C: 'text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-950/50',
  D: 'text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-950/50',
  F: 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-950/50',
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
      const msg = err instanceof Error ? err.message : '加载失败'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // Auto-refresh when the user navigates back to /cards or refocuses the
  // tab. Without this the page stays mounted across React Router transitions
  // and silently goes stale after the user generates a new card on /skills.
  const location = useLocation()
  useEffect(() => {
    if (location.pathname === '/cards') void load()
  }, [location.pathname, load])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && location.pathname === '/cards') {
        void load()
      }
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

  const handleDownload = (card: StoredSkillCard) => {
    const blob = new Blob([card.html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${card.skillName}-card.html`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('已下载')
  }

  const handleCopy = async (card: StoredSkillCard) => {
    try {
      await navigator.clipboard.writeText(card.html)
      toast.success('HTML 源码已复制')
    } catch {
      toast.error('复制失败,请手动复制')
    }
  }

  const handleOpenNewTab = (card: StoredSkillCard) => {
    const blob = new Blob([card.html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const filtered = query
    ? cards.filter(c =>
        c.skillName.toLowerCase().includes(query.toLowerCase()) ||
        c.title.toLowerCase().includes(query.toLowerCase()),
      )
    : cards

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
                  <Badge className={GRADE_COLORS.A + ' shrink-0 text-[10px]'}>已评测</Badge>
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

      {/* Preview Dialog */}
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

          <div className="flex-1 min-h-0 border border-border rounded-md bg-muted/30 overflow-hidden">
            {preview && (
              <iframe
                title="卡片预览"
                // sandbox="" (empty) = most restrictive: no scripts,
                // no same-origin, no top-nav. Matches SkillCardDialog.
                srcDoc={preview.html}
                sandbox=""
                className="w-full h-full border-0 bg-white"
                style={{ minHeight: '480px' }}
              />
            )}
          </div>

          <DialogFooter className="flex-row flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => preview && handleCopy(preview)}>
              <Copy className="mr-1 h-3.5 w-3.5" />
              复制 HTML
            </Button>
            <Button variant="outline" size="sm" onClick={() => preview && handleOpenNewTab(preview)}>
              <ExternalLink className="mr-1 h-3.5 w-3.5" />
              新标签页打开
            </Button>
            <Button size="sm" onClick={() => preview && handleDownload(preview)}>
              <Download className="mr-1 h-3.5 w-3.5" />
              下载 .html
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
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
