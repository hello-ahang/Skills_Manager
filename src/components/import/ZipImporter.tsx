import { useState, useRef } from 'react'
import { useImportStore } from '@/stores/importStore'
import { importApi } from '@/api/client'
import { toast } from 'sonner'
import { Archive, Upload, Loader2 } from 'lucide-react'

export default function ZipImporter() {
  const {
    setScanning, setScanError, setScannedSkills,
    setImportStep, setImportSource,
  } = useImportStore()
  const [loading, setLoading] = useState(false)
  const [fileName, setFileName] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      toast.error('目前仅支持 ZIP 格式')
      return
    }

    setFileName(file.name)
    setLoading(true)
    setScanning(true)
    setScanError(null)

    try {
      const result = await importApi.uploadZip(file)
      setScannedSkills(result.skills)
      setImportSource('zip')
      setImportStep(2)
      toast.success(`解压完成，发现 ${result.skills.length} 个 Skill`)
    } catch (error: any) {
      setScanError(error.message)
      toast.error(error.message || '上传失败')
    } finally {
      setLoading(false)
      setScanning(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Archive className="h-4 w-4" />
        <span>ZIP 压缩包导入</span>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors ${
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <p className="text-sm text-muted-foreground">正在解压 {fileName}...</p>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">拖放 ZIP 文件到此处</p>
            <p className="text-xs text-muted-foreground mt-1">或点击选择文件</p>
            {fileName && (
              <p className="text-xs text-primary mt-2">已选择: {fileName}</p>
            )}
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        onChange={handleFileSelect}
        className="hidden"
      />

      <p className="text-xs text-muted-foreground">
        支持 ZIP 格式，最大 100MB
      </p>
    </div>
  )
}