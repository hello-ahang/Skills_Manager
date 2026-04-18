import { useState } from 'react'
import { useImportStore } from '@/stores/importStore'
import { importApi } from '@/api/client'
import { toast } from 'sonner'
import { GitBranch, Star, Loader2, ExternalLink } from 'lucide-react'

export default function GitRepoImporter() {
  const {
    sourceUrl, setSourceUrl, setScanning, setScanError,
    setScannedSkills, setRepoInfo, setImportStep, setImportSource,
  } = useImportStore()
  const [branch, setBranch] = useState('')
  const [loading, setLoading] = useState(false)
  const repoInfo = useImportStore(s => s.repoInfo)

  const handleScan = async () => {
    if (!sourceUrl.trim()) {
      toast.error('请输入 GitHub 仓库地址')
      return
    }

    setLoading(true)
    setScanning(true)
    setScanError(null)

    try {
      const result = await importApi.scanGitHub(sourceUrl.trim(), branch || undefined)
      setScannedSkills(result.skills)
      setRepoInfo(result.repoInfo)
      setImportSource('github')
      setImportStep(2)
      toast.success(`扫描完成，发现 ${result.skills.length} 个 Skill`)
    } catch (error: any) {
      setScanError(error.message)
      toast.error(error.message || '扫描失败')
    } finally {
      setLoading(false)
      setScanning(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header with browse link */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">GitHub 仓库导入</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            从 GitHub 仓库导入 Skills
          </p>
        </div>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          浏览 GitHub
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* URL input */}
      <div>
        <label className="text-sm font-medium mb-1 block">仓库地址</label>
        <input
          type="text"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          onKeyDown={(e) => e.key === 'Enter' && handleScan()}
        />
        <p className="text-xs text-muted-foreground mt-1">
          支持完整仓库、子目录、特定分支/标签
        </p>
      </div>

      {/* Branch input */}
      <div>
        <label className="text-sm font-medium mb-1 block">
          <GitBranch className="h-3 w-3 inline mr-1" />
          分支/标签（可选）
        </label>
        <input
          type="text"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          placeholder="默认使用仓库主分支"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Repo info */}
      {repoInfo && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{repoInfo.name}</span>
            {repoInfo.stars !== undefined && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="h-3 w-3" /> {repoInfo.stars}
              </span>
            )}
          </div>
          {repoInfo.description && (
            <p className="text-xs text-muted-foreground">{repoInfo.description}</p>
          )}
        </div>
      )}

      {/* Scan button */}
      <button
        onClick={handleScan}
        disabled={loading || !sourceUrl.trim()}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            扫描中...
          </>
        ) : (
          '扫描仓库'
        )}
      </button>
    </div>
  )
}
