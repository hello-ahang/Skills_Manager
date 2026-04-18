import { useEffect, useState } from 'react'
import { importApi } from '@/api/client'
import { toast } from 'sonner'
import { BarChart3, Loader2, TrendingUp, Clock, CheckCircle2 } from 'lucide-react'
import type { ImportStats } from '@/types'

export default function ImportAnalytics() {
  const [stats, setStats] = useState<ImportStats | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchStats = async () => {
    setLoading(true)
    try {
      const result = await importApi.getStats()
      setStats(result.stats)
    } catch {
      toast.error('加载统计数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const sourceLabels: Record<string, string> = {
    github: 'GitHub',
    gitee: 'Gitee',
    gitlab: 'GitLab',
    bitbucket: 'Bitbucket',
    local: '本地',
    zip: 'ZIP',
    clipboard: '剪贴板',
    batch: '批量',
  }

  const maxSourceCount = Math.max(...stats.bySource.map(s => s.count), 1)

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <BarChart3 className="h-4 w-4" />
        导入统计
      </h3>

      {/* Overview cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold">{stats.totalImports}</div>
          <div className="text-xs text-muted-foreground">总导入次数</div>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.successRate}%</div>
          <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> 成功率
          </div>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold">
            {stats.avgDuration < 1000 ? `${stats.avgDuration}ms` : `${(stats.avgDuration / 1000).toFixed(1)}s`}
          </div>
          <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            <Clock className="h-3 w-3" /> 平均耗时
          </div>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold">{stats.bySource.length}</div>
          <div className="text-xs text-muted-foreground">来源渠道</div>
        </div>
      </div>

      {/* Source distribution */}
      {stats.bySource.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium">来源分布</h4>
          <div className="space-y-2">
            {stats.bySource.map((item) => (
              <div key={item.source} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{sourceLabels[item.source] || item.source}</span>
                  <span className="text-muted-foreground">{item.count}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(item.count / maxSourceCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent trend */}
      {stats.recentTrend.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> 近30天趋势
          </h4>
          <div className="flex items-end gap-0.5 h-20">
            {stats.recentTrend.map((day) => {
              const maxCount = Math.max(...stats.recentTrend.map(d => d.count), 1)
              const height = day.count > 0 ? Math.max((day.count / maxCount) * 100, 4) : 2
              return (
                <div
                  key={day.date}
                  className="flex-1 rounded-t bg-primary/60 hover:bg-primary transition-colors cursor-default"
                  style={{ height: `${height}%` }}
                  title={`${day.date}: ${day.count} 次导入`}
                />
              )
            })}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{stats.recentTrend[0]?.date}</span>
            <span>{stats.recentTrend[stats.recentTrend.length - 1]?.date}</span>
          </div>
        </div>
      )}
    </div>
  )
}