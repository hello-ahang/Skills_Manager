import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface ConflictResolverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectName: string
  tool: string
  onResolve: (strategy: 'backup-replace' | 'skip') => void
}

export default function ConflictResolver({
  open,
  onOpenChange,
  projectName,
  tool,
  onResolve,
}: ConflictResolverProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            链接冲突
          </DialogTitle>
          <DialogDescription>
            项目 <strong>{projectName}</strong> 的 <strong>.{tool}/skills</strong> 目录已存在真实文件夹，
            无法直接创建软链接。请选择处理方式：
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <button
            className="w-full rounded-lg border p-3 text-left hover:bg-accent transition-colors"
            onClick={() => onResolve('backup-replace')}
          >
            <p className="font-medium text-sm">备份并替换</p>
            <p className="text-xs text-muted-foreground mt-1">
              将现有目录备份（添加 _backup 后缀），然后创建软链接
            </p>
          </button>
          <button
            className="w-full rounded-lg border p-3 text-left hover:bg-accent transition-colors"
            onClick={() => onResolve('skip')}
          >
            <p className="font-medium text-sm">跳过</p>
            <p className="text-xs text-muted-foreground mt-1">
              保留现有目录，不创建软链接
            </p>
          </button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
