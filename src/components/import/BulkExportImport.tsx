import { useState } from 'react'
import { importApi } from '@/api/client'
import { useImportStore } from '@/stores/importStore'
import { toast } from 'sonner'
import { Download, Upload, FileSpreadsheet, FileJson, Loader2 } from 'lucide-react'

export default function BulkExportImport() {
  const { importOptions, setImporting, setImportResult, setImportStep } = useImportStore()
  const [importContent, setImportContent] = useState('')
  const [importFormat, setImportFormat] = useState<'csv' | 'json'>('csv')
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleImport = async () => {
    if (!importContent.trim()) {
      toast.error('请输入内容')
      return
    }

    setLoading(true)
    setImporting(true)
    setImportStep(3)

    try {
      let result
      if (importFormat === 'csv') {
        result = await importApi.importCSV(importContent, importOptions)
      } else {
        result = await importApi.importJSON(importContent, importOptions)
      }
      setImportResult(result.result)
      setImportStep(4)
      toast.success(`导入完成: ${result.result.successCount} 个成功`)
    } catch (error: any) {
      toast.error(error.message || '导入失败')
      setImportStep(1)
    } finally {
      setLoading(false)
      setImporting(false)
    }
  }

  const handleExportCSV = async () => {
    setExporting(true)
    try {
      await importApi.exportCSV()
      toast.success('CSV 导出成功')
    } catch {
      toast.error('导出失败')
    } finally {
      setExporting(false)
    }
  }

  const handleExportJSON = async () => {
    setExporting(true)
    try {
      await importApi.exportJSON()
      toast.success('JSON 导出成功')
    } catch {
      toast.error('导出失败')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Export section */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Download className="h-4 w-4" />
          导出导入历史
        </h4>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="flex-1 flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            导出 CSV
          </button>
          <button
            onClick={handleExportJSON}
            disabled={exporting}
            className="flex-1 flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            <FileJson className="h-4 w-4" />
            导出 JSON
          </button>
        </div>
      </div>

      <div className="border-t" />

      {/* Import section */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Upload className="h-4 w-4" />
          从 CSV/JSON 批量导入
        </h4>

        <div className="flex gap-2">
          <button
            onClick={() => setImportFormat('csv')}
            className={`flex-1 rounded-md border px-3 py-1.5 text-xs transition-colors ${
              importFormat === 'csv' ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'
            }`}
          >
            CSV 格式
          </button>
          <button
            onClick={() => setImportFormat('json')}
            className={`flex-1 rounded-md border px-3 py-1.5 text-xs transition-colors ${
              importFormat === 'json' ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'
            }`}
          >
            JSON 格式
          </button>
        </div>

        <textarea
          value={importContent}
          onChange={(e) => setImportContent(e.target.value)}
          placeholder={importFormat === 'csv'
            ? '# CSV 格式：每行一个 URL\nhttps://github.com/user/repo1\nhttps://github.com/user/repo2'
            : '[\n  "https://github.com/user/repo1",\n  {"url": "https://github.com/user/repo2"}\n]'
          }
          className="w-full h-32 rounded-md border bg-background px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary"
        />

        <button
          onClick={handleImport}
          disabled={loading || !importContent.trim()}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" />导入中...</>
          ) : (
            `从 ${importFormat.toUpperCase()} 导入`
          )}
        </button>
      </div>
    </div>
  )
}