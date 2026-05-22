import { useEffect, useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, Sparkles, AlertCircle, Clock } from 'lucide-react'
import { skillCardApi, type SkillCardData } from '@/api/client'
import CardPreview from './CardPreview'

interface SkillCardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  skillPath: string | null
  skillName?: string
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  const days = Math.floor(diff / 86_400_000)
  if (days < 30) return `${days} 天前`
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function SkillCardDialog({ open, onOpenChange, skillPath, skillName }: SkillCardDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [html, setHtml] = useState<string>('')
  const [data, setData] = useState<SkillCardData | null>(null)
  const [useAI, setUseAI] = useState(true)
  const [cachedAt, setCachedAt] = useState<string | null>(null)

  // Derived: this render's content came from the by-path cache, not a fresh
  // generate. Used to swap the helper-text chip for a "last generated …" one.
  const fromCache = !loading && !error && cachedAt !== null && html !== ''

  const fileName = (skillName || skillPath?.split('/').pop() || 'skill') + '-card.html'

  const generate = useCallback(async (path: string, includeAI: boolean) => {
    setLoading(true)
    setError(null)
    try {
      const result = await skillCardApi.generate({ skillPath: path, includeAI })
      setHtml(result.html)
      setData(result.data)
      setCachedAt(result.generatedAt || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败')
      setHtml('')
      setData(null)
      setCachedAt(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // On open: try the persisted card first so refresh/restart doesn't re-pay
  // the AI cost. Deps deliberately omit `useAI`/`generate` — toggling AI
  // must not auto-regenerate; only the explicit "重新生成" button does that.
  useEffect(() => {
    if (!open || !skillPath) return
    let cancelled = false
    void (async () => {
      try {
        const { card } = await skillCardApi.byPath(skillPath)
        if (cancelled) return
        if (card) {
          setHtml(card.html)
          setData(card.data)
          setCachedAt(card.generatedAt)
          setError(null)
          return
        }
      } catch {
        // by-path failure falls through; generate will surface its own error
      }
      if (cancelled) return
      await generate(skillPath, useAI)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, skillPath])

  useEffect(() => {
    if (!open) {
      setHtml('')
      setData(null)
      setCachedAt(null)
      setError(null)
    }
  }, [open])

  const handleRegenerate = () => {
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
          <Button
            className="ml-auto"
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

        {loading && (
          <div className="flex-1 min-h-0 border border-border rounded-md bg-muted/30 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {useAI ? '正在调用 AI 生成卡片…（约 5–30 秒）' : '正在生成卡片…'}
          </div>
        )}
        {!loading && error && (
          <div className="flex-1 min-h-0 border border-border rounded-md bg-muted/30 flex flex-col items-center justify-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={handleRegenerate}>
              重试
            </Button>
          </div>
        )}
        {!loading && !error && html && (
          <CardPreview
            html={html}
            fileName={fileName}
            footerLeft={
              <>
                {data?.aiUsed ? '由 AI 提炼' : data ? '静态提取' : ''}
                {data?.rubric && ` · 质量分 ${data.rubric.overall} (${data.rubric.grade})`}
              </>
            }
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
