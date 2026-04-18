import { useState } from 'react'
import { useImportStore } from '@/stores/importStore'
import { importApi } from '@/api/client'
import { toast } from 'sonner'
import { Link2, Loader2 } from 'lucide-react'

export default function BatchImporter() {
  const {
    importOptions, setImporting, setImportResult, setImportStep,
  } = useImportStore()
  const [urls, setUrls] = useState('')
  const [loading, setLoading] = useState(false)

  const urlList = urls.split('\n').filter(u => u.trim())

  const handleBatchImport = async () => {
    if (urlList.length === 0) {
      toast.error('请输入至少一个链接')
      return
    }

    setLoading(true)
    setImporting(true)
    setImportStep(3)

    try {
      const result = await importApi.batch(urlList, importOptions)
      setImportResult(result.result)
      setImportStep(4)
      toast.success(`批量导入完成: ${result.result.successCount} 个成功`)
    } catch (error: any) {
      toast.error(error.message || '批量导入失败')
      setImportStep(1)
    } finally {
      setLoading(false)
      setImporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Link2 className="h-4 w-4" />
        <span>批量导入</span>
      </div>

      <textarea
        value={urls}
        onChange={(e) => setUrls(e.target.value)}
        placeholder="每行一个链接，支持 GitHub、Gitee、GitLab、Bitbucket&#10;https://github.com/user/repo1&#10;https://github.com/user/repo2&#10;https://gitee.com/user/repo3"
        className="w-full h-32 rounded-md border bg-background px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary"
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {urlList.length} 个链接
        </span>
      </div>

      <button
        onClick={handleBatchImport}
        disabled={loading || urlList.length === 0}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            批量导入中...
          </>
        ) : (
          `批量导入 ${urlList.length} 个链接`
        )}
      </button>
    </div>
  )
}