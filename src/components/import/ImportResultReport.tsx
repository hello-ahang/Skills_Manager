import { useImportStore } from '@/stores/importStore'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, XCircle, SkipForward, Clock, ArrowRight } from 'lucide-react'

export default function ImportResultReport() {
  const { importResult, resetWizard } = useImportStore()
  const navigate = useNavigate()

  if (!importResult) return null

  const { successCount, skipCount, failCount, totalCount, duration, importedSkills, skippedSkills, failedSkills } = importResult

  return (
    <div className="space-y-4">
      <div className="text-center py-4">
        {failCount === 0 ? (
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
        ) : (
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-2" />
        )}
        <h3 className="text-lg font-semibold">导入完成</h3>
        <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
          <Clock className="h-3 w-3" />
          耗时 {duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-green-500/5 p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{successCount}</div>
          <div className="text-xs text-muted-foreground">成功</div>
        </div>
        <div className="rounded-lg border bg-yellow-500/5 p-3 text-center">
          <div className="text-2xl font-bold text-yellow-600">{skipCount}</div>
          <div className="text-xs text-muted-foreground">跳过</div>
        </div>
        <div className="rounded-lg border bg-red-500/5 p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{failCount}</div>
          <div className="text-xs text-muted-foreground">失败</div>
        </div>
      </div>

      {/* Detail lists */}
      <div className="space-y-3 max-h-60 overflow-auto">
        {importedSkills.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-green-600 mb-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> 成功导入
            </h4>
            <div className="space-y-1">
              {importedSkills.map((skill, i) => (
                <div key={i} className="text-xs text-muted-foreground pl-4">
                  {skill.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {skippedSkills.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-yellow-600 mb-1 flex items-center gap-1">
              <SkipForward className="h-3 w-3" /> 已跳过
            </h4>
            <div className="space-y-1">
              {skippedSkills.map((skill, i) => (
                <div key={i} className="text-xs text-muted-foreground pl-4">
                  {skill.name} — {skill.reason}
                </div>
              ))}
            </div>
          </div>
        )}

        {failedSkills.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-red-600 mb-1 flex items-center gap-1">
              <XCircle className="h-3 w-3" /> 导入失败
            </h4>
            <div className="space-y-1">
              {failedSkills.map((skill, i) => (
                <div key={i} className="text-xs text-red-400 pl-4">
                  {skill.name} — {skill.error}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t">
        <button
          onClick={() => {
            resetWizard()
          }}
          className="flex-1 rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors"
        >
          继续导入
        </button>
        <button
          onClick={() => {
            resetWizard()
            navigate('/skills')
          }}
          className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-1"
        >
          查看 Skills 库 <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}