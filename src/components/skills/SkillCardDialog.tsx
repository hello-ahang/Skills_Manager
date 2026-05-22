import { useEffect, useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, Download, Copy, ExternalLink, Sparkles, AlertCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { skillCardApi, type SkillCardData } from '@/api/client'

interface SkillCardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Absolute path to the skill directory (the parent of SKILL.md). */
  skillPath: string | null
  /** Display name for the toast / file download. */
  skillName?: string
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  const days = Math.floor(diff / 86_400_000)
  if (days < 30) return `${days} 天前`
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Renders the server-generated HTML inside an iframe (srcDoc) so the card's
 * inline styles can't leak into the host page, then offers three actions:
 * download .html, copy HTML source, open in a new tab.
 *
 * AI is opt-in via a toggle (default on). Re-generating updates the preview
 * in-place.
 */
export default function SkillCardDialog({ open, onOpenChange, skillPath, skillName }: SkillCardDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [html, setHtml] = useState<string>('')
  const [data, setData] = useState<SkillCardData | null>(null)
  const [useAI, setUseAI] = useState(true)
  const [cardId, setCardId] = useState<string | null>(null)
  const [cachedAt, setCachedAt] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)

  const fileName = (skillName || (skillPath ? skillPath.split('/').pop() : 'skill') || 'skill') + '-card.html'

  const generate = useCallback(async (path: string, includeAI: boolean) => {
    setLoading(true)
    setError(null)
    setFromCache(false)
    try {
      const result = await skillCardApi.generate({ skillPath: path, includeAI })
      setHtml(result.html)
      setData(result.data)
      setCardId(result.cardId || null)
      setCachedAt(result.generatedAt || null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '生成失败'
      setError(msg)
      setHtml('')
      setData(null)
      setCardId(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // On open: try to show the previously persisted card instantly, then
  // fall back to generate. This is the persistence payoff — refreshing
  // the page or restarting sm won't re-trigger AI calls.
  useEffect(() => {
    if (!open || !skillPath) return

    let cancelled = false
    const loadCachedThenMaybeGenerate = async () => {
      try {
        const { card } = await skillCardApi.byPath(skillPath)
        if (cancelled) return
        if (card) {
          setHtml(card.html)
          setData(card.data)
          setCardId(card.id)
          setCachedAt(card.generatedAt)
          setFromCache(true)
          setError(null)
          // Cache hit — skip generate to avoid paying AI cost on reopen.
          return
        }
      } catch {
        // by-path failure (e.g., pathGuard 403) is non-fatal — fall through
        // to generate, which will surface the error in its own catch.
      }
      if (cancelled) return
      await generate(skillPath, useAI)
    }
    void loadCachedThenMaybeGenerate()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, skillPath])

  // Reset content when the dialog closes so the next open shows a fresh
  // loading state instead of stale data from a previous skill.
  useEffect(() => {
    if (!open) {
      setHtml('')
      setData(null)
      setCardId(null)
      setCachedAt(null)
      setFromCache(false)
      setError(null)
    }
  }, [open])

  const handleDownload = () => {
    if (!html) return
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`已下载 ${fileName}`)
  }

  const handleCopy = async () => {
    if (!html) return
    try {
      await navigator.clipboard.writeText(html)
      toast.success('HTML 源码已复制')
    } catch {
      toast.error('复制失败，请手动复制')
    }
  }

  const handleOpenInNewTab = () => {
    if (!html) return
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    // Note: we don't revoke immediately — the new tab needs the URL until
    // it finishes loading. Browsers GC blob URLs on page unload.
  }

  const handleRegenerate = () => {
    // Regenerate explicitly bypasses the cache and pays AI cost again.
    if (skillPath) void generate(skillPath, useAI)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] !flex !flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-600" />
            Skill 可视化卡片
            {data && (
              <span className="text-sm font-normal text-muted-foreground">· {data.name}</span>
            )}
          </DialogTitle>
          <DialogDescription>
            一屏可读的 HTML 卡片，可下载为单文件分享给非技术同事。
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 px-1 py-2 text-sm">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useAI}
              onChange={(e) => setUseAI(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            <span>使用 AI 提炼文案</span>
          </label>
          {fromCache && cachedAt ? (
            <span className="inline-flex items-center gap-1 text-xs text-violet-700 bg-violet-50 dark:text-violet-300 dark:bg-violet-950/40 px-2 py-0.5 rounded-md">
              <Clock className="h-3 w-3" />
              上次生成于 {formatRelative(cachedAt)} · 点「重新生成」刷新
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {useAI ? '关闭后改用纯静态抽取（更快）' : '开启后用 AI 重写为非技术语言'}
            </span>
          )}
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={loading || !skillPath}
            >
              {loading ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
              )}
              重新生成
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 border border-border rounded-md bg-muted/30 overflow-hidden">
          {loading && (
            <div className="h-full flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {useAI ? '正在调用 AI 生成卡片…（约 5–30 秒）' : '正在生成卡片…'}
            </div>
          )}
          {!loading && error && (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={handleRegenerate}>
                重试
              </Button>
            </div>
          )}
          {!loading && !error && html && (
            <iframe
              title="Skill 卡片预览"
              srcDoc={html}
              sandbox=""
              className="w-full h-full border-0 bg-white"
              style={{ minHeight: '480px' }}
            />
          )}
        </div>

        <DialogFooter className="flex-row flex-wrap gap-2 sm:gap-2">
          <div className="mr-auto text-xs text-muted-foreground self-center">
            {data?.aiUsed ? '由 AI 提炼' : data ? '静态提取' : ''}
            {data?.rubric && ` · 质量分 ${data.rubric.overall} (${data.rubric.grade})`}
            {cardId && ' · 已保存到卡片库'}
          </div>
          <Button variant="outline" size="sm" onClick={handleCopy} disabled={!html}>
            <Copy className="mr-1 h-3.5 w-3.5" />
            复制 HTML
          </Button>
          <Button variant="outline" size="sm" onClick={handleOpenInNewTab} disabled={!html}>
            <ExternalLink className="mr-1 h-3.5 w-3.5" />
            新标签页打开
          </Button>
          <Button size="sm" onClick={handleDownload} disabled={!html}>
            <Download className="mr-1 h-3.5 w-3.5" />
            下载 .html
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
