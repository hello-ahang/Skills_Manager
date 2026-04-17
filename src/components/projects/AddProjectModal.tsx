import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Trash2 } from 'lucide-react'

const PRESET_PROJECTS = [
  { name: 'Qoder', defaultPath: '~/.qoder/skills' },
  { name: 'Cursor', defaultPath: '~/.cursor/skills-cursor' },
  { name: 'Copilot', defaultPath: '~/.copilot/skills' },
  { name: 'Codex', defaultPath: '~/.codex/skills' },
  { name: 'Claude', defaultPath: '~/.claude/skills' },
  { name: 'OpenClaw', defaultPath: '~/.openclaw/skills' },
  { name: 'QoderWork', defaultPath: '~/.qoderwork/skills' },
]

interface PresetState {
  selected: boolean
  path: string
}

interface CustomProject {
  name: string
  path: string
}

interface AddProjectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (items: { path: string; name?: string }[]) => Promise<void>
  existingPaths?: string[]
}

// Normalize path for comparison: expand ~ and remove trailing slash
function normalizePath(p: string): string {
  let normalized = p.trim()
  if (normalized.endsWith('/')) normalized = normalized.slice(0, -1)
  return normalized
}

export default function AddProjectModal({ open, onOpenChange, onAdd, existingPaths = [] }: AddProjectModalProps) {
  // Check if a preset path is already in the project list
  const isPresetAdded = (presetPath: string): boolean => {
    const normalized = normalizePath(presetPath)
    return existingPaths.some((ep) => {
      const normalizedExisting = normalizePath(ep)
      // Compare: either exact match, or ~ expanded match
      // Since backend expands ~ to home dir, we compare both forms
      return normalizedExisting === normalized ||
        normalizedExisting.endsWith(normalized.replace('~', '')) ||
        normalized.endsWith(normalizedExisting.replace(/^\/Users\/[^/]+/, '~'))
    })
  }

  const [presets, setPresets] = useState<PresetState[]>(
    PRESET_PROJECTS.map((p) => ({ selected: false, path: p.defaultPath }))
  )
  const [customProjects, setCustomProjects] = useState<CustomProject[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const togglePreset = (index: number) => {
    setPresets((prev) =>
      prev.map((p, i) => (i === index ? { ...p, selected: !p.selected } : p))
    )
  }

  const updatePresetPath = (index: number, path: string) => {
    setPresets((prev) =>
      prev.map((p, i) => (i === index ? { ...p, path } : p))
    )
  }

  const addCustomProject = () => {
    setCustomProjects((prev) => [...prev, { name: '', path: '' }])
  }

  const updateCustomProject = (index: number, field: keyof CustomProject, value: string) => {
    setCustomProjects((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    )
  }

  const removeCustomProject = (index: number) => {
    setCustomProjects((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    const items: { path: string; name?: string }[] = []

    // Collect selected presets
    presets.forEach((p, i) => {
      if (p.selected && p.path.trim()) {
        items.push({ path: p.path.trim(), name: PRESET_PROJECTS[i].name })
      }
    })

    // Collect custom projects
    customProjects.forEach((cp) => {
      if (cp.path.trim()) {
        items.push({ path: cp.path.trim(), name: cp.name.trim() || undefined })
      }
    })

    if (items.length === 0) {
      setError('请至少选择一个预制项目或添加一个自定义项目')
      return
    }

    setLoading(true)
    setError('')

    try {
      await onAdd(items)
      // Reset state
      setPresets(PRESET_PROJECTS.map((p) => ({ selected: false, path: p.defaultPath })))
      setCustomProjects([])
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加项目失败')
    } finally {
      setLoading(false)
    }
  }

  const selectedCount = presets.filter((p) => p.selected).length + customProjects.filter((p) => p.path.trim()).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>添加项目</DialogTitle>
          <DialogDescription>
            选择预制的 AI 工具项目，或手动添加自定义项目。路径支持 ~ 表示用户目录。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Preset Projects */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">预制项目</Label>
            <div className="space-y-2">
              {PRESET_PROJECTS.map((preset, index) => {
                const alreadyAdded = isPresetAdded(presets[index].path)
                return (
                  <div
                    key={preset.name}
                    className={`flex items-center gap-3 rounded-md border p-2.5 ${alreadyAdded ? 'opacity-50 bg-muted/50' : ''}`}
                  >
                    <Checkbox
                      id={`preset-${index}`}
                      checked={alreadyAdded || presets[index].selected}
                      onCheckedChange={() => !alreadyAdded && togglePreset(index)}
                      disabled={alreadyAdded}
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <label
                        htmlFor={`preset-${index}`}
                        className={`text-sm font-medium ${alreadyAdded ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        {preset.name}
                        {alreadyAdded && (
                          <span className="ml-2 text-xs text-muted-foreground font-normal">已添加</span>
                        )}
                      </label>
                      <Input
                        value={presets[index].path}
                        onChange={(e) => updatePresetPath(index, e.target.value)}
                        className="h-7 text-xs"
                        placeholder={preset.defaultPath}
                        disabled={alreadyAdded}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <Separator />

          {/* Custom Projects */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">自定义项目</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={addCustomProject}
              >
                <Plus className="mr-1 h-3 w-3" />
                添加
              </Button>
            </div>
            {customProjects.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center">
                点击上方"添加"按钮来添加自定义项目
              </p>
            ) : (
              <div className="space-y-2">
                {customProjects.map((cp, index) => (
                  <div key={index} className="flex items-start gap-2 rounded-md border p-2.5">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <Input
                        value={cp.name}
                        onChange={(e) => updateCustomProject(index, 'name', e.target.value)}
                        className="h-7 text-xs"
                        placeholder="项目名称（可选）"
                      />
                      <Input
                        value={cp.path}
                        onChange={(e) => updateCustomProject(index, 'path', e.target.value)}
                        className="h-7 text-xs"
                        placeholder="项目路径，如 ~/.my-tool/skills"
                      />
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-accent text-muted-foreground hover:text-destructive shrink-0 mt-0.5 cursor-pointer"
                      onClick={() => removeCustomProject(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={loading || selectedCount === 0}>
            {loading ? '添加中...' : `添加${selectedCount > 0 ? ` (${selectedCount})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
