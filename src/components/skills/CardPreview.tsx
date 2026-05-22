import { Button } from '@/components/ui/button'
import { Copy, Download, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

interface CardPreviewProps {
  /** The self-contained HTML document to preview and act on. */
  html: string
  /** File name (with .html) used when the user downloads the card. */
  fileName: string
  /** Optional left-aligned footer slot (e.g., AI / static + Rubric stats). */
  footerLeft?: React.ReactNode
  /** Minimum iframe height. Default 480px. */
  minHeight?: number
}

function downloadHtml(html: string, fileName: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  // queueMicrotask so Firefox finishes the download dispatch before the
  // blob is collected; Chrome doesn't strictly need it but it's harmless.
  queueMicrotask(() => URL.revokeObjectURL(url))
  toast.success(`已下载 ${fileName}`)
}

async function copyHtml(html: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(html)
    toast.success('HTML 源码已复制')
  } catch {
    toast.error('复制失败，请手动复制')
  }
}

function openHtmlInNewTab(html: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  // Delay revoke so the new tab has time to load before the blob is GC'd.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Shared preview surface for skill cards: sandbox-isolated iframe plus the
 * download / copy / open-in-new-tab action row. Used by both
 * SkillCardDialog (live generation) and SkillCardsPage (library preview).
 */
export default function CardPreview({ html, fileName, footerLeft, minHeight = 480 }: CardPreviewProps) {
  return (
    <>
      <div className="flex-1 min-h-0 border border-border rounded-md bg-muted/30 overflow-hidden">
        <iframe
          title="Skill 卡片预览"
          srcDoc={html}
          // sandbox="" (empty) applies the most restrictive sandbox policy:
          // no scripts, no same-origin, no forms, no top-nav.
          sandbox=""
          className="w-full h-full border-0 bg-white"
          style={{ minHeight: `${minHeight}px` }}
        />
      </div>

      <div className="flex flex-row flex-wrap gap-2 items-center">
        <div className="mr-auto text-xs text-muted-foreground self-center">
          {footerLeft}
        </div>
        <Button variant="outline" size="sm" onClick={() => void copyHtml(html)}>
          <Copy className="mr-1 h-3.5 w-3.5" />
          复制 HTML
        </Button>
        <Button variant="outline" size="sm" onClick={() => openHtmlInNewTab(html)}>
          <ExternalLink className="mr-1 h-3.5 w-3.5" />
          新标签页打开
        </Button>
        <Button size="sm" onClick={() => downloadHtml(html, fileName)}>
          <Download className="mr-1 h-3.5 w-3.5" />
          下载 .html
        </Button>
      </div>
    </>
  )
}
