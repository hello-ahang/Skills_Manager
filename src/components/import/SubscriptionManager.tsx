import { useEffect, useState } from 'react'
import { useImportStore } from '@/stores/importStore'
import { importApi } from '@/api/client'
import { toast } from 'sonner'
import {
  Bell, Trash2, RefreshCw, Loader2, ArrowDownCircle,
  CheckCircle2, Tag, AlertCircle,
} from 'lucide-react'
import type { Subscription } from '@/types'

export default function SubscriptionManager() {
  const { subscriptions, setSubscriptions } = useImportStore()
  const [loading, setLoading] = useState(false)
  const [checkingId, setCheckingId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [checkingAll, setCheckingAll] = useState(false)

  const fetchSubscriptions = async () => {
    setLoading(true)
    try {
      const result = await importApi.getSubscriptions()
      setSubscriptions(result.subscriptions)
    } catch {
      toast.error('加载订阅列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSubscriptions()
  }, [])

  // Merge subscriptions with same sourceUrl — keep only the latest one
  const mergedSubscriptions = (() => {
    const urlMap = new Map<string, Subscription>()
    for (const sub of subscriptions) {
      const existing = urlMap.get(sub.sourceUrl)
      if (!existing || new Date(sub.subscribedAt) > new Date(existing.subscribedAt)) {
        urlMap.set(sub.sourceUrl, sub)
      }
    }
    return Array.from(urlMap.values())
  })()

  const handleUnsubscribe = async (skillPath: string) => {
    if (!confirm('确定取消订阅？')) return
    try {
      await importApi.unsubscribe(skillPath)
      setSubscriptions(subscriptions.filter(s => s.skillPath !== skillPath))
      toast.success('已取消订阅')
    } catch {
      toast.error('取消订阅失败')
    }
  }

  const handleCheckUpdate = async (skillPath: string, subId: string) => {
    setCheckingId(subId)
    try {
      const result = await importApi.checkUpdate(skillPath)
      if (result.hasUpdate) {
        toast.info('发现新版本可用')
      } else {
        toast.success('已是最新版本')
      }
      await fetchSubscriptions()
    } catch {
      toast.error('检查更新失败')
    } finally {
      setCheckingId(null)
    }
  }

  const handleCheckAllUpdates = async () => {
    setCheckingAll(true)
    try {
      const result = await importApi.checkAllUpdates()
      const updatesCount = result.results.filter(r => r.hasUpdate).length
      if (updatesCount > 0) {
        toast.info(`发现 ${updatesCount} 个订阅有新版本`)
      } else {
        toast.success('所有订阅均为最新版本')
      }
      await fetchSubscriptions()
    } catch {
      toast.error('批量检查更新失败')
    } finally {
      setCheckingAll(false)
    }
  }

  const handleApplyUpdate = async (skillPath: string, subId: string) => {
    setUpdatingId(subId)
    try {
      const result = await importApi.applyUpdate(skillPath)
      toast.success(`更新完成: ${result.result.successCount} 个文件已更新`)
      await fetchSubscriptions()
    } catch (error: any) {
      toast.error(error.message || '更新失败')
    } finally {
      setUpdatingId(null)
    }
  }

  const sourceLabels: Record<string, string> = {
    github: 'GitHub',
    gitee: 'Gitee',
    gitlab: 'GitLab',
    bitbucket: 'Bitbucket',
    clawhub: 'ClawHub',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Bell className="h-4 w-4" />
          订阅管理
          {mergedSubscriptions.length > 0 && (
            <span className="text-xs text-muted-foreground font-normal">
              ({mergedSubscriptions.length})
            </span>
          )}
        </h3>
        <div className="flex items-center gap-1">
          {mergedSubscriptions.length > 0 && (
            <button
              onClick={handleCheckAllUpdates}
              disabled={checkingAll}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-muted transition-colors disabled:opacity-50"
              title="批量检查更新"
            >
              {checkingAll ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              批量检查
            </button>
          )}
          <button onClick={fetchSubscriptions} className="p-1 hover:bg-muted rounded" title="刷新">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && subscriptions.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : mergedSubscriptions.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>暂无订阅</p>
          <p className="text-xs mt-1">在导入历史中点击"订阅"按钮即可添加</p>
        </div>
      ) : (
        <div className="space-y-2">
          {mergedSubscriptions.map((sub) => (
            <div
              key={sub.id}
              className={`rounded-lg border p-3 space-y-2 ${
                sub.hasUpdate ? 'border-primary/40 bg-primary/5' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{sub.skillName}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-muted">
                    {sourceLabels[sub.source] || sub.source}
                  </span>
                  {/* Version info */}
                  {sub.version && (
                    <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded bg-muted/50 font-mono text-muted-foreground">
                      <Tag className="h-2.5 w-2.5" />
                      {sub.version.length > 10 ? sub.version.substring(0, 7) : sub.version}
                    </span>
                  )}
                  {/* Update available badge */}
                  {sub.hasUpdate && (
                    <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                      <AlertCircle className="h-2.5 w-2.5" />
                      有更新
                      {sub.latestVersion && (
                        <span className="font-mono ml-0.5">
                          → {sub.latestVersion.length > 10 ? sub.latestVersion.substring(0, 7) : sub.latestVersion}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleUnsubscribe(sub.skillPath)}
                  className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-red-500"
                  title="取消订阅"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>

              <p className="text-xs text-muted-foreground truncate">{sub.sourceUrl}</p>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="space-x-3">
                  {sub.lastCheckedAt && (
                    <span>上次检查: {new Date(sub.lastCheckedAt).toLocaleString()}</span>
                  )}
                  {sub.lastUpdatedAt && (
                    <span>上次更新: {new Date(sub.lastUpdatedAt).toLocaleString()}</span>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleCheckUpdate(sub.skillPath, sub.id)}
                    disabled={checkingId === sub.id}
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    {checkingId === sub.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    检查
                  </button>
                  {sub.hasUpdate && (
                    <button
                      onClick={() => handleApplyUpdate(sub.skillPath, sub.id)}
                      disabled={updatingId === sub.id}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {updatingId === sub.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <ArrowDownCircle className="h-3 w-3" />
                      )}
                      更新
                    </button>
                  )}
                  {!sub.hasUpdate && (
                    <button
                      onClick={() => handleApplyUpdate(sub.skillPath, sub.id)}
                      disabled={updatingId === sub.id}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                    >
                      {updatingId === sub.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <ArrowDownCircle className="h-3 w-3" />
                      )}
                      强制更新
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}