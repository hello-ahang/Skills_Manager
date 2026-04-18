import { useState } from 'react'
import { useImportStore } from '@/stores/importStore'
import { importApi } from '@/api/client'
import { toast } from 'sonner'
import ConflictDialog from './ConflictDialog'
import ImportResultReport from './ImportResultReport'
import {
  ChevronLeft, ChevronRight, Loader2, FileText,
  CheckSquare, Square, FolderOpen,
} from 'lucide-react'

/**
 * ImportWizard — handles Step 2 (preview), Step 3 (executing), Step 4 (result).
 * Step 1 is now managed by ImportPage's left-right split layout.
 */
export default function ImportWizard() {
  const {
    importStep, setImportStep, importSource,
    scannedSkills, importOptions, setImportOptions,
    setImporting, setImportProgress, setImportResult,
    toggleSkillSelection, selectAllSkills,
    sourceUrl,
  } = useImportStore()

  // Filter mode: 'valid' = only valid skills, 'all' = all folders
  const [filterMode, setFilterMode] = useState<'valid' | 'all'>('valid')

  const validSkills = scannedSkills.filter(s => s.isValid)
  const hasInvalidFolders = scannedSkills.some(s => !s.isValid)
  const displayedSkills = filterMode === 'valid' ? validSkills : scannedSkills
  const selectedCount = scannedSkills.filter(s => s.selected).length
  const hasConflicts = scannedSkills.some(s => s.hasConflict && s.selected)

  const handleExecuteImport = async () => {
    const selectedSkills = scannedSkills.filter(s => s.selected)
    if (selectedSkills.length === 0) {
      toast.error('请至少选择一个 Skill')
      return
    }

    setImporting(true)
    setImportStep(3)
    setImportProgress('正在导入...')

    try {
      const result = await importApi.execute({
        source: importSource || 'local',
        skills: selectedSkills,
        options: importOptions,
        sourceUrl: sourceUrl || undefined,
      })
      setImportResult(result.result)
      setImportStep(4)
      toast.success(`导入完成: ${result.result.successCount} 个成功`)
    } catch (error: any) {
      toast.error(error.message || '导入失败')
      setImportStep(2)
    } finally {
      setImporting(false)
    }
  }

  // Step 2: Preview & confirm
  if (importStep === 2) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground font-bold">2</div>
          <h3 className="text-sm font-semibold">预览确认</h3>
        </div>

        {/* Filter toggle + Skills list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                发现 {validSkills.length} 个有效 Skill
                {hasInvalidFolders && `，${scannedSkills.length - validSkills.length} 个其他文件夹`}
                ，已选 {selectedCount} 个
              </span>
            </div>
            <div className="flex items-center gap-3">
              {/* Filter mode toggle */}
              {hasInvalidFolders && (
                <div className="flex gap-0.5 rounded-md border bg-muted/30 p-0.5">
                  <button
                    onClick={() => setFilterMode('valid')}
                    className={`rounded px-2 py-0.5 text-xs transition-colors ${
                      filterMode === 'valid'
                        ? 'bg-background text-foreground shadow-sm font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    仅有效 Skill
                  </button>
                  <button
                    onClick={() => setFilterMode('all')}
                    className={`rounded px-2 py-0.5 text-xs transition-colors ${
                      filterMode === 'all'
                        ? 'bg-background text-foreground shadow-sm font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    全部文件夹
                  </button>
                </div>
              )}
              <button
                onClick={() => selectAllSkills(true)}
                className="text-xs text-primary hover:underline"
              >
                全选
              </button>
              <button
                onClick={() => selectAllSkills(false)}
                className="text-xs text-muted-foreground hover:underline"
              >
                全不选
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-auto space-y-1 rounded-lg border p-2">
            {displayedSkills.map((skill) => {
              // Find the original index in scannedSkills for toggle
              const originalIndex = scannedSkills.findIndex(s => s.path === skill.path)
              return (
                <div
                  key={skill.path}
                  onClick={() => toggleSkillSelection(originalIndex)}
                  className={`flex items-center gap-2 rounded-md p-2 cursor-pointer transition-colors ${
                    skill.selected ? 'bg-primary/5' : 'hover:bg-muted'
                  }`}
                >
                  {skill.selected ? (
                    <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm font-medium truncate">{skill.name}</span>
                      {skill.isValid && (
                        <span className="text-[10px] px-1 rounded bg-green-500/10 text-green-600">有效</span>
                      )}
                      {!skill.isValid && (
                        <span className="text-[10px] px-1 rounded bg-yellow-500/10 text-yellow-600">无 SKILL.md</span>
                      )}
                      {skill.hasConflict && (
                        <span className="text-[10px] px-1 rounded bg-red-500/10 text-red-500">冲突</span>
                      )}
                    </div>
                    {skill.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{skill.description}</p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    <FileText className="h-3 w-3 inline mr-0.5" />
                    {skill.fileCount} 文件
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Conflict handling */}
        {hasConflicts && <ConflictDialog />}

        {/* Other options */}
        <div className="space-y-3 rounded-lg border p-3">
          <h4 className="text-sm font-medium">导入选项</h4>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={importOptions.autoSnapshot}
                onChange={(e) => setImportOptions({ autoSnapshot: e.target.checked })}
                className="rounded"
              />
              自动创建快照
            </label>
          </div>

          {!hasConflicts && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">默认冲突处理</label>
              <select
                value={importOptions.conflictStrategy}
                onChange={(e) => setImportOptions({ conflictStrategy: e.target.value as any })}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              >
                <option value="skip">跳过</option>
                <option value="overwrite">覆盖（自动备份）</option>
                <option value="rename">重命名</option>
                <option value="merge">合并</option>
              </select>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => setImportStep(1)}
            className="flex items-center gap-1 rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-3 w-3" /> 返回
          </button>
          <button
            onClick={handleExecuteImport}
            disabled={selectedCount === 0}
            className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
          >
            导入 {selectedCount} 个 Skill <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    )
  }

  // Step 3: Executing
  if (importStep === 3) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-medium">正在导入...</p>
        <p className="text-xs text-muted-foreground">请勿关闭页面</p>
      </div>
    )
  }

  // Step 4: Result
  if (importStep === 4) {
    return <ImportResultReport />
  }

  return null
}