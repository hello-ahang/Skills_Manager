import { useState } from 'react'
import { useImportStore } from '@/stores/importStore'
import { importApi } from '@/api/client'
import { toast } from 'sonner'
import { FolderOpen, Loader2, X } from 'lucide-react'

export default function LocalImporter() {
  const {
    setScanning, setScanError, setScannedSkills,
    setImportStep, setImportSource,
  } = useImportStore()
  const [selectedPath, setSelectedPath] = useState('')
  const [selecting, setSelecting] = useState(false)
  const [scanning, setLocalScanning] = useState(false)

  const handleSelectPath = async () => {
    setSelecting(true)
    try {
      const result = await importApi.selectPath()
      if (result.path) {
        setSelectedPath(result.path)
      }
    } catch (error: any) {
      toast.error(error.message || '选择路径失败')
    } finally {
      setSelecting(false)
    }
  }

  const handleScan = async () => {
    if (!selectedPath) {
      toast.error('请先选择文件或文件夹')
      return
    }

    setLocalScanning(true)
    setScanning(true)
    setScanError(null)

    try {
      const result = await importApi.scanLocal(selectedPath)
      setScannedSkills(result.skills)
      setImportSource('local')
      setImportStep(2)
      toast.success(`扫描完成，发现 ${result.skills.length} 个 Skill`)
    } catch (error: any) {
      setScanError(error.message)
      toast.error(error.message || '扫描失败')
    } finally {
      setLocalScanning(false)
      setScanning(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Select path button */}
      <div>
        <label className="text-sm font-medium mb-2 block">选择文件或文件夹</label>
        <button
          onClick={handleSelectPath}
          disabled={selecting}
          className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-sm text-muted-foreground hover:border-primary/50 hover:bg-muted/30 hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
        >
          {selecting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              正在打开文件选择器...
            </>
          ) : (
            <>
              <FolderOpen className="h-5 w-5" />
              点击选择本地文件/文件夹
            </>
          )}
        </button>
      </div>

      {/* Selected path display */}
      {selectedPath && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
          <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm truncate flex-1">{selectedPath}</span>
          <button
            onClick={() => setSelectedPath('')}
            className="p-0.5 hover:bg-muted rounded shrink-0"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Scan button */}
      <button
        onClick={handleScan}
        disabled={scanning || !selectedPath}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {scanning ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            扫描中...
          </>
        ) : (
          '扫描路径'
        )}
      </button>
    </div>
  )
}