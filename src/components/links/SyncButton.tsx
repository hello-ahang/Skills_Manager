import { Button } from '@/components/ui/button'
import { Link, Unlink, RefreshCw } from 'lucide-react'

interface SyncButtonProps {
  selectedCount: number
  syncing: boolean
  onSync: () => void
  onSyncAll: () => void
  onUnlinkAll: () => void
}

export default function SyncButton({
  selectedCount,
  syncing,
  onSync,
  onSyncAll,
  onUnlinkAll,
}: SyncButtonProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border p-3">
      <span className="text-sm text-muted-foreground">
        已选择 <strong>{selectedCount}</strong> 个项目
      </span>
      <div className="ml-auto flex items-center gap-2">
        <Button
          size="sm"
          onClick={onSync}
          disabled={selectedCount === 0 || syncing}
        >
          {syncing ? (
            <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Link className="mr-1.5 h-3.5 w-3.5" />
          )}
          {syncing ? '同步中...' : '同步选中项目'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onSyncAll}
          disabled={syncing}
        >
          <Link className="mr-1.5 h-3.5 w-3.5" />
          全部创建链接
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onUnlinkAll}
          disabled={syncing}
        >
          <Unlink className="mr-1.5 h-3.5 w-3.5" />
          全部解除链接
        </Button>
      </div>
    </div>
  )
}
