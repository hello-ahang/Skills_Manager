import { useImportStore } from '@/stores/importStore'
import { AlertTriangle } from 'lucide-react'

export default function ConflictDialog() {
  const { scannedSkills, setSkillConflictAction } = useImportStore()

  const conflictSkills = scannedSkills.filter(s => s.hasConflict && s.selected)

  if (conflictSkills.length === 0) return null

  const applyToAll = (action: string) => {
    scannedSkills.forEach((skill, index) => {
      if (skill.hasConflict && skill.selected) {
        setSkillConflictAction(index, action)
      }
    })
  }

  return (
    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm font-medium">
          发现 {conflictSkills.length} 个同名冲突
        </span>
      </div>

      <div className="space-y-2">
        {scannedSkills.map((skill, index) => {
          if (!skill.hasConflict || !skill.selected) return null

          return (
            <div key={index} className="flex items-center justify-between rounded-md border bg-background p-2">
              <span className="text-sm font-medium truncate flex-1">{skill.name}</span>
              <div className="flex gap-1 ml-2">
                {[
                  { value: 'overwrite', label: '覆盖', color: 'text-red-500' },
                  { value: 'rename', label: '重命名', color: 'text-blue-500' },
                  { value: 'skip', label: '跳过', color: 'text-muted-foreground' },
                  { value: 'merge', label: '合并', color: 'text-green-500' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSkillConflictAction(index, option.value)}
                    className={`rounded px-2 py-0.5 text-xs transition-colors ${
                      skill.conflictAction === option.value
                        ? 'bg-primary text-primary-foreground'
                        : `hover:bg-muted ${option.color}`
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-2 pt-1 border-t">
        <span className="text-xs text-muted-foreground">全部应用:</span>
        {['overwrite', 'rename', 'skip', 'merge'].map((action) => (
          <button
            key={action}
            onClick={() => applyToAll(action)}
            className="rounded px-2 py-0.5 text-xs hover:bg-muted transition-colors"
          >
            {{ overwrite: '覆盖', rename: '重命名', skip: '跳过', merge: '合并' }[action]}
          </button>
        ))}
      </div>
    </div>
  )
}