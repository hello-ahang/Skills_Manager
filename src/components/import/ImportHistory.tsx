import { useEffect, useState } from 'react'
import { useImportStore } from '@/stores/importStore'
import { importApi } from '@/api/client'
import { toast } from 'sonner'
import { History, Trash2, RefreshCw, Loader2, CheckCircle2, XCircle, Bell, BellOff, Tag } from 'lucide-react'
import type { ImportHistoryItem } from '@/types'

// Sources that support subscription (git repos + clawhub)
const subscribableSources = ['github', 'clawhub']

export default function ImportHistory() {
  const { importHistory, setImportHistory } = useImportStore()
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<string>('')
  const [subscribingId, setSubscribingId] = useState<string | null>(null)

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const result = await importApi.getHistory(filter || undefined)
      setImportHistory(result.history)
    } catch (error: any) {
      toast.error('加载历史记录失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [filter])

  const handleDelete = async (id: string) => {
    try {
      await importApi.deleteHistory(id)
      setImportHistory(importHistory.filter(h => h.id !== id))
      toast.success('已删除')
    } catch {
      toast.error('删除失败')
    }
  }

  const handleClearAll = async () => {
    if (!confirm('确定清空所有导入历史？')) return
    try {
      await importApi.clearHistory()
      setImportHistory([])
      toast.success('已清空')
    } catch {
      toast.error('清空失败')
    }
  }

  const handleSubscribe = async (item: ImportHistoryItem) => {
    if (!item.sourceUrl) return
    setSubscribingId(item.id)
    try {
      // Use the first successfully imported skill name, or extract from URL
      const skillName = item.result.importedSkills?.[0]?.name || item.sourceUrl.split('/').pop() || 'unknown'
      const skillPath = item.result.importedSkills?.[0]?.path || ''
      await importApi.subscribe({
        skillPath,
        skillName,
        source: item.source,
        sourceUrl: item.sourceUrl,
        version: item.version,
      })
      // Mark as subscribed in local state
      setImportHistory(importHistory.map(h =>
        h.id === item.id ? { ...h, subscribed: true } : h
      ))
      toast.success('已订阅，可在订阅列表中查看更新')
    } catch (error: any) {
      toast.error(error.message || '订阅失败')
    } finally {
      setSubscribingId(null)
    }
  }

  const sourceLabels: Record<string, string> = {
    github: 'GitHub',
    clawhub: 'ClawHub',
    local: '本地文件',
    zip: 'ZIP 压缩包',
    clipboard: '剪贴板',
    batch: '批量导入',
  }

  const isSubscribable = (source: string) => subscribableSources.includes(source)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <History className="h-4 w-4" />
          导入历史
        </h3>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-md border bg-background px-2 py-1 text-xs"
          >
            <option value="">全部来源</option>
            {Object.entries(sourceLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <button onClick={fetchHistory} className="p-1 hover:bg-muted rounded" title="刷新">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {importHistory.length > 0 && (
            <button onClick={handleClearAll} className="p-1 hover:bg-muted rounded text-red-500" title="清空">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {loading && importHistory.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : importHistory.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          暂无导入记录
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-auto">
          {importHistory.map((item) => (
            <div key={item.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-muted font-medium">
                    {sourceLabels[item.source] || item.source}
                  </span>
                  {/* Version badge for git/clawhub sources */}
                  {isSubscribable(item.source) && item.version && (
                    <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
                      <Tag className="h-2.5 w-2.5" />
                      {item.version.length > 10 ? item.version.substring(0, 7) : item.version}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {/* Subscribe button for git/clawhub sources */}
                  {isSubscribable(item.source) && item.sourceUrl && (
                    item.subscribed ? (
                      <span className="flex items-center gap-1 text-xs text-primary px-1.5 py-0.5 rounded bg-primary/5">
                        <Bell className="h-3 w-3" />
                        已订阅
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSubscribe(item)}
                        disabled={subscribingId === item.id}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary px-1.5 py-0.5 rounded hover:bg-primary/5 transition-colors disabled:opacity-50"
                        title="订阅更新"
                      >
                        {subscribingId === item.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <BellOff className="h-3 w-3" />
                        )}
                        订阅
                      </button>
                    )
                  )}
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-red-500"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {item.sourceUrl && (
                <p className="text-xs text-muted-foreground truncate">{item.sourceUrl}</p>
              )}

              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-3 w-3" /> {item.result.successCount} 成功
                </span>
                {item.result.skipCount > 0 && (
                  <span className="text-yellow-600">{item.result.skipCount} 跳过</span>
                )}
                {item.result.failCount > 0 && (
                  <span className="flex items-center gap-1 text-red-500">
                    <XCircle className="h-3 w-3" /> {item.result.failCount} 失败
                  </span>
                )}
                <span className="text-muted-foreground">
                  {item.result.duration < 1000
                    ? `${item.result.duration}ms`
                    : `${(item.result.duration / 1000).toFixed(1)}s`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}