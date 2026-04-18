import { useState } from 'react'
import { useImportStore } from '@/stores/importStore'
import { importApi } from '@/api/client'
import { toast } from 'sonner'
import { Loader2, Download, ExternalLink } from 'lucide-react'

export default function ClawHubImporter() {
  const {
    sourceUrl, setSourceUrl, setScanning, setScanError,
    setScannedSkills, setRepoInfo, setImportStep, setImportSource,
  } = useImportStore()
  const [loading, setLoading] = useState(false)
  const repoInfo = useImportStore(s => s.repoInfo)

  const handleImport = async () => {
    if (!sourceUrl.trim()) {
      toast.error('请输入 ClawHub Skill 链接')
      return
    }

    setLoading(true)
    setScanning(true)
    setScanError(null)

    try {
      const result = await importApi.scanClawHub(sourceUrl.trim())
      setScannedSkills(result.skills)
      setRepoInfo(result.repoInfo)
      setImportSource('clawhub')
      setImportStep(2)
      toast.success(`扫描完成，发现 ${result.skills.length} 个 Skill`)
    } catch (error: any) {
      setScanError(error.message)
      toast.error(error.message || '导入失败')
    } finally {
      setLoading(false)
      setScanning(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">ClawHub Skill 导入</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            从 ClawHub 技能市场导入 OpenClaw Skills
          </p>
        </div>
        <a
          href="https://clawhub.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          浏览 ClawHub
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* URL input */}
      <div>
        <label className="text-sm font-medium mb-1 block">Skill 链接</label>
        <input
          type="text"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="https://clawhub.ai/owner/skill-name"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          onKeyDown={(e) => e.key === 'Enter' && handleImport()}
        />
        <p className="text-xs text-muted-foreground mt-1">
          粘贴 ClawHub 上的 Skill 页面链接即可导入
        </p>
      </div>

      {/* Repo info preview */}
      {repoInfo && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{repoInfo.name}</span>
            {repoInfo.version && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
                v{repoInfo.version}
              </span>
            )}
          </div>
          {repoInfo.description && (
            <p className="text-xs text-muted-foreground">{repoInfo.description}</p>
          )}
        </div>
      )}

      {/* Import button */}
      <button
        onClick={handleImport}
        disabled={loading || !sourceUrl.trim()}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            导入中...
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            导入 Skill
          </>
        )}
      </button>
    </div>
  )
}
