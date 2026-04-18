import { useState } from 'react'
import { useImportStore } from '@/stores/importStore'
import { importApi } from '@/api/client'
import { toast } from 'sonner'
import { GitBranch, Star, Loader2 } from 'lucide-react'

export default function GiteeImporter() {
  const {
    setScanning, setScanError, setScannedSkills,
    setRepoInfo, setImportStep, setImportSource,
  } = useImportStore()
  const [url, setUrl] = useState('')
  const [branch, setBranch] = useState('')
  const [loading, setLoading] = useState(false)
  const repoInfo = useImportStore(s => s.repoInfo)

  const handleScan = async () => {
    if (!url.trim()) {
      toast.error('请输入 Gitee 仓库地址')
      return
    }

    setLoading(true)
    setScanning(true)
    setScanError(null)

    try {
      const result = await importApi.scanGitee(url.trim(), branch || undefined)
      setScannedSkills(result.skills)
      setRepoInfo(result.repoInfo)
      setImportSource('gitee')
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
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <span className="text-red-500 font-bold text-xs">G</span>
        <span>Gitee 仓库导入</span>
      </div>

      <div>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://gitee.com/owner/repo"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          onKeyDown={(e) => e.key === 'Enter' && handleScan()}
        />
      </div>

      <div>
        <input
          type="text"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          placeholder="分支（可选，默认主分支）"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <button
        onClick={handleScan}
        disabled={loading || !url.trim()}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" />扫描中...</> : '扫描仓库'}
      </button>
    </div>
  )
}