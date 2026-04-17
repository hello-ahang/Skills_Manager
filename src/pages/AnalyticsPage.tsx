import { useState, useEffect, useCallback } from 'react'
import { analyticsApi } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  BarChart3,
  Eye,
  Save,
  Sparkles,
  Wand2,
  Download,
  GitBranch,
  RotateCcw,
  Link,
  Unlink,
  Activity,
  TrendingUp,
  Zap,
  Trash2,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import type { AnalyticsDashboard, AnalyticsEvent } from '@/types'

const EVENT_CONFIG: Record<string, { label: string; icon: typeof Eye; color: string }> = {
  'view': { label: '查看', icon: Eye, color: 'text-blue-500' },
  'edit': { label: '编辑', icon: Save, color: 'text-green-500' },
  'save': { label: '保存', icon: Save, color: 'text-green-600' },
  'link': { label: '链接', icon: Link, color: 'text-purple-500' },
  'unlink': { label: '解绑', icon: Unlink, color: 'text-orange-500' },
  'ai-optimize': { label: 'AI 优化', icon: Sparkles, color: 'text-violet-500' },
  'ai-generate': { label: 'AI 生成', icon: Wand2, color: 'text-pink-500' },
  'export': { label: '导出', icon: Download, color: 'text-cyan-500' },
  'version-create': { label: '创建版本', icon: GitBranch, color: 'text-teal-500' },
  'version-restore': { label: '回滚版本', icon: RotateCcw, color: 'text-amber-500' },
}

function formatTime(ts: string): string {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  if (diffHour < 24) return `${diffHour} 小时前`
  if (diffDay < 7) return `${diffDay} 天前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function extractName(skillPath: string): string {
  const parts = skillPath.split('/').filter(Boolean)
  const last = parts[parts.length - 1] || ''
  // If last segment has a file extension (e.g. SKILL.md), return parent directory name
  if (last.includes('.')) {
    return parts[parts.length - 2] || last
  }
  return last || skillPath
}

export default function AnalyticsPage() {
  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [clearing, setClearing] = useState(false)

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true)
      const data = await analyticsApi.getDashboard()
      setDashboard(data)
    } catch {
      toast.error('加载分析数据失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const handleClear = async () => {
    try {
      setClearing(true)
      await analyticsApi.clearAll()
      toast.success('已清除所有分析数据')
      setShowClearDialog(false)
      await fetchDashboard()
    } catch {
      toast.error('清除失败')
    } finally {
      setClearing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>加载分析数据...</span>
        </div>
      </div>
    )
  }

  const overview = dashboard?.overview
  const skillStats = dashboard?.skillStats || []
  const recentActivity = dashboard?.recentActivity || []
  const maxTotal = skillStats.length > 0
    ? Math.max(...skillStats.map(s => s.totalViews + s.totalEdits + s.aiOptimizeCount + s.aiGenerateCount + s.exportCount + s.versionCount))
    : 1

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">使用分析</h1>
          <p className="text-sm text-muted-foreground mt-1">追踪 Skills 的使用情况，所有数据存储在本地</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchDashboard}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            刷新
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setShowClearDialog(true)}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            清除数据
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">总事件数</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.totalEvents || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">追踪 Skills</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.totalSkillsTracked || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">今日活动</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.todayEvents || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">最活跃 Skill</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {overview?.mostActiveSkill ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-default">
                      <div className="text-lg font-bold truncate">{overview.mostActiveSkill.folderName}</div>
                      <p className="text-xs text-muted-foreground">{overview.mostActiveSkill.count} 次操作</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="font-medium">{overview.mostActiveSkill.name}</p>
                    {overview.mostActiveSkill.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{overview.mostActiveSkill.description}</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <div className="text-lg font-bold truncate">—</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content: Skills Ranking + Recent Activity */}
      <div className="grid grid-cols-5 gap-6">
        {/* Skills Ranking (60%) */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="text-base">热门 Skills 排行</CardTitle>
          </CardHeader>
          <CardContent>
            {skillStats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <BarChart3 className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">暂无数据</p>
                <p className="text-xs mt-1">使用 Skills 后，这里会展示排行</p>
              </div>
            ) : (
              <div className="space-y-3">
                {skillStats.slice(0, 10).map((skill, idx) => {
                  const total = skill.totalViews + skill.totalEdits + skill.aiOptimizeCount + skill.aiGenerateCount + skill.exportCount + skill.versionCount
                  const barWidth = Math.max((total / maxTotal) * 100, 4)
                  return (
                    <div key={skill.skillPath} className="group">
                      <div className="flex items-center gap-3">
                        <span className="w-5 text-right text-xs font-mono text-muted-foreground">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-sm font-medium truncate cursor-default">{skill.folderName || extractName(skill.skillPath)}</span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <p className="font-medium">{skill.skillName}</p>
                                  {skill.description && (
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{skill.description}</p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <span className="text-[11px] text-muted-foreground">{total} 次</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary/70 transition-all duration-500"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                            {skill.totalViews > 0 && <span>👁 {skill.totalViews}</span>}
                            {skill.totalEdits > 0 && <span>✏️ {skill.totalEdits}</span>}
                            {skill.aiOptimizeCount > 0 && <span>✨ {skill.aiOptimizeCount}</span>}
                            {skill.aiGenerateCount > 0 && <span>🪄 {skill.aiGenerateCount}</span>}
                            {skill.exportCount > 0 && <span>📦 {skill.exportCount}</span>}
                            {skill.versionCount > 0 && <span>🔖 {skill.versionCount}</span>}
                            {skill.lastActivityAt && (
                              <span className="ml-auto">最近 {formatTime(skill.lastActivityAt)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity (40%) */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="text-base">最近活动</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Activity className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">暂无活动</p>
                <p className="text-xs mt-1">操作 Skills 后，这里会展示记录</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-[480px] overflow-y-auto pr-1">
                {recentActivity.slice(0, 20).map((event: AnalyticsEvent) => {
                  const config = EVENT_CONFIG[event.eventType] || { label: event.eventType, icon: Activity, color: 'text-muted-foreground' }
                  const Icon = config.icon
                  return (
                    <div key={event.id} className="flex items-start gap-2.5 py-1.5 px-1 rounded hover:bg-muted/50 transition-colors">
                      <div className={`mt-0.5 ${config.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5 shrink-0">
                            {config.label}
                          </Badge>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs truncate cursor-default">{extractName(event.skillPath)}</span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-medium">{event.skillName || extractName(event.skillPath)}</p>
                                {event.metadata?.description && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{event.metadata.description}</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{formatTime(event.timestamp)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Clear Data Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认清除所有分析数据？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将删除所有使用记录，包括事件日志和统计数据。此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClear}
              disabled={clearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {clearing ? '清除中...' : '确认清除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
