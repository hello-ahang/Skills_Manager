import { useState } from 'react'
import { useImportStore } from '@/stores/importStore'
import { importApi } from '@/api/client'
import { toast } from 'sonner'
import { ClipboardPaste, Loader2 } from 'lucide-react'

export default function ClipboardImporter() {
  const {
    setScanning, setScanError, setScannedSkills,
    setImportStep, setImportSource,
  } = useImportStore()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)

  const handleScan = async () => {
    if (!content.trim()) {
      toast.error('请输入或粘贴内容')
      return
    }

    setLoading(true)
    setScanning(true)
    setScanError(null)

    try {
      const result = await importApi.scanClipboard(content.trim())
      setScannedSkills(result.skills)
      setImportSource('clipboard')
      setImportStep(2)
      toast.success(`解析完成，发现 ${result.skills.length} 个 Skill`)
    } catch (error: any) {
      setScanError(error.message)
      toast.error(error.message || '解析失败')
    } finally {
      setLoading(false)
      setScanning(false)
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setContent(text)
        toast.success('已从剪贴板粘贴')
      }
    } catch {
      toast.error('无法读取剪贴板')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <ClipboardPaste className="h-4 w-4" />
          <span>剪贴板导入</span>
        </div>
        <button
          onClick={handlePaste}
          className="text-xs text-primary hover:underline"
        >
          从剪贴板粘贴
        </button>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="粘贴 SKILL.md 内容或 Markdown 文本..."
        className="w-full h-40 rounded-md border bg-background px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary"
      />

      <p className="text-xs text-muted-foreground">
        将自动从 Markdown 一级标题提取 Skill 名称
      </p>

      <button
        onClick={handleScan}
        disabled={loading || !content.trim()}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            解析中...
          </>
        ) : (
          '解析内容'
        )}
      </button>
    </div>
  )
}