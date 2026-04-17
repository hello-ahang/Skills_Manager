import { useState, useEffect, useCallback } from 'react'
import { versionsApi } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { toast } from 'sonner'
import { Plus, RotateCcw, Trash2, GitCompareArrows, ChevronDown, ChevronRight, Clock, FileText, FilePlus, FileMinus, FileEdit, X } from 'lucide-react'
import type { SkillVersion, VersionDiff } from '@/types'

interface VersionHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  skillPath: string
  skillName: string
  onRestored?: () => void
}

export default function VersionHistoryDialog({
  open,
  onOpenChange,
  skillPath,
  skillName,
  onRestored,
}: VersionHistoryDialogProps) {
  const [versions, setVersions] = useState<SkillVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newVersion, setNewVersion] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [creating, setCreating] = useState(false)

  // Diff state
  const [diffVersionId, setDiffVersionId] = useState<string | null>(null)
  const [diffs, setDiffs] = useState<VersionDiff[]>([])
  const [diffLoading, setDiffLoading] = useState(false)
  const [expandedDiffFile, setExpandedDiffFile] = useState<string | null>(null)

  // Restore confirm
  const [restoreId, setRestoreId] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const fetchVersions = useCallback(async () => {
    if (!skillPath) return
    setLoading(true)
    try {
      const res = await versionsApi.getHistory(skillPath)
      setVersions(res.versions || [])
    } catch {
      toast.error('获取版本历史失败')
    } finally {
      setLoading(false)
    }
  }, [skillPath])

  useEffect(() => {
    if (open && skillPath) {
      fetchVersions()
      // Reset states
      setShowCreateForm(false)
      setDiffVersionId(null)
      setDiffs([])
      setExpandedDiffFile(null)
    }
  }, [open, skillPath, fetchVersions])

  const handleCreate = async () => {
    if (!newVersion.trim()) {
      toast.error('请输入版本号')
      return
    }
    setCreating(true)
    try {
      await versionsApi.create(skillPath, newVersion.trim(), newLabel.trim() || undefined)
      toast.success(`版本 ${newVersion.trim()} 创建成功`)
      setNewVersion('')
      setNewLabel('')
      setShowCreateForm(false)
      await fetchVersions()
    } catch {
      toast.error('创建版本失败')
    } finally {
      setCreating(false)
    }
  }

  const handleDiff = async (versionId: string) => {
    if (diffVersionId === versionId) {
      setDiffVersionId(null)
      setDiffs([])
      setExpandedDiffFile(null)
      return
    }
    setDiffVersionId(versionId)
    setDiffLoading(true)
    setExpandedDiffFile(null)
    try {
      const res = await versionsApi.diff(versionId)
      setDiffs(res.diffs || [])
    } catch {
      toast.error('对比失败')
    } finally {
      setDiffLoading(false)
    }
  }

  const handleRestore = async () => {
    if (!restoreId) return
    setRestoring(true)
    try {
      await versionsApi.restore(restoreId)
      toast.success('版本已回滚（已自动创建回滚前备份）')
      setRestoreId(null)
      await fetchVersions()
      onRestored?.()
    } catch {
      toast.error('回滚失败')
    } finally {
      setRestoring(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await versionsApi.remove(deleteId)
      toast.success('版本已删除')
      setDeleteId(null)
      if (diffVersionId === deleteId) {
        setDiffVersionId(null)
        setDiffs([])
      }
      await fetchVersions()
    } catch {
      toast.error('删除失败')
    }
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return '刚刚'
    if (diffMin < 60) return `${diffMin} 分钟前`
    const diffHour = Math.floor(diffMin / 60)
    if (diffHour < 24) return `${diffHour} 小时前`
    const diffDay = Math.floor(diffHour / 24)
    if (diffDay < 7) return `${diffDay} 天前`
    return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const diffStatusIcon = (status: string) => {
    switch (status) {
      case 'added': return <FilePlus className="h-3.5 w-3.5 text-green-500" />
      case 'removed': return <FileMinus className="h-3.5 w-3.5 text-red-500" />
      case 'modified': return <FileEdit className="h-3.5 w-3.5 text-amber-500" />
      default: return <FileText className="h-3.5 w-3.5 text-muted-foreground" />
    }
  }

  const diffStatusLabel = (status: string) => {
    switch (status) {
      case 'added': return '新增'
      case 'removed': return '已删除'
      case 'modified': return '已修改'
      default: return '未变更'
    }
  }

  const diffStatusColor = (status: string) => {
    switch (status) {
      case 'added': return 'text-green-600 dark:text-green-400'
      case 'removed': return 'text-red-600 dark:text-red-400'
      case 'modified': return 'text-amber-600 dark:text-amber-400'
      default: return 'text-muted-foreground'
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              版本历史 — {skillName}
            </DialogTitle>
          </DialogHeader>

          {/* Create snapshot form */}
          <div className="space-y-2">
            {showCreateForm ? (
              <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">版本号</Label>
                    <Input
                      value={newVersion}
                      onChange={(e) => setNewVersion(e.target.value)}
                      placeholder="如 1.0.0"
                      className="h-8 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleCreate()
                      }}
                      autoFocus
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">标签（可选）</Label>
                    <Input
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="如 重构前备份"
                      className="h-8 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleCreate()
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setShowCreateForm(false)} className="h-7 text-xs">
                    取消
                  </Button>
                  <Button size="sm" onClick={handleCreate} disabled={creating || !newVersion.trim()} className="h-7 text-xs">
                    {creating ? '创建中...' : '创建快照'}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateForm(true)}
                className="w-full h-8 text-xs"
              >
                <Plus className="mr-1 h-3 w-3" />
                创建快照
              </Button>
            )}
          </div>

          <Separator />

          {/* Version list */}
          <ScrollArea className="flex-1 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                加载中...
              </div>
            ) : versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">暂无版本记录</p>
                <p className="text-xs text-muted-foreground/60 mt-1">点击上方「创建快照」保存当前状态</p>
              </div>
            ) : (
              <div className="space-y-1 pr-3">
                {versions.map((v, idx) => (
                  <div key={v.id} className="group">
                    {/* Version item */}
                    <div className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                      {/* Timeline dot */}
                      <div className="flex flex-col items-center pt-1.5">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${idx === 0 ? 'bg-blue-500' : 'bg-muted-foreground/30'}`} />
                        {idx < versions.length - 1 && (
                          <div className="w-px flex-1 bg-muted-foreground/15 mt-1 min-h-[20px]" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium">{v.version}</span>
                          {v.label && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                              {v.label}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                          <span>{formatTime(v.createdAt)}</span>
                          <span>{v.fileCount} 个文件</span>
                          <span>{formatSize(v.totalSize)}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className={`h-6 px-2 text-[11px] ${diffVersionId === v.id ? 'text-blue-600 border-blue-300 bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:bg-blue-950/30' : ''}`}
                          onClick={() => handleDiff(v.id)}
                        >
                          <GitCompareArrows className="mr-1 h-3 w-3" />
                          对比
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => setRestoreId(v.id)}
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          回滚
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[11px] text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => setDeleteId(v.id)}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          删除
                        </Button>
                      </div>
                    </div>

                    {/* Diff panel */}
                    {diffVersionId === v.id && (
                      <div className="ml-7 mt-1 mb-2 border rounded-lg overflow-hidden bg-muted/20">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40 border-b">
                          <span className="text-xs font-medium">与当前内容对比</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0"
                            onClick={() => { setDiffVersionId(null); setDiffs([]); setExpandedDiffFile(null); }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        {diffLoading ? (
                          <div className="p-4 text-center text-xs text-muted-foreground">加载中...</div>
                        ) : diffs.length === 0 ? (
                          <div className="p-4 text-center text-xs text-muted-foreground">无差异，内容完全一致</div>
                        ) : (
                          <div className="divide-y">
                            {diffs.filter(d => d.status !== 'unchanged').map((d) => (
                              <div key={d.relativePath}>
                                <button
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/30 transition-colors text-left"
                                  onClick={() => setExpandedDiffFile(expandedDiffFile === d.relativePath ? null : d.relativePath)}
                                >
                                  {expandedDiffFile === d.relativePath ? (
                                    <ChevronDown className="h-3 w-3 shrink-0" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3 shrink-0" />
                                  )}
                                  {diffStatusIcon(d.status)}
                                  <span className="font-mono truncate flex-1">{d.relativePath}</span>
                                  <span className={`text-[10px] shrink-0 ${diffStatusColor(d.status)}`}>
                                    {diffStatusLabel(d.status)}
                                  </span>
                                </button>
                                {expandedDiffFile === d.relativePath && (
                                  <div className="px-3 pb-2">
                                    <div className="rounded border bg-background overflow-hidden">
                                      {d.status === 'added' && (
                                        <div className="p-2">
                                          <div className="text-[10px] text-green-600 dark:text-green-400 font-medium mb-1">当前内容（新增文件）</div>
                                          <pre className="text-[11px] whitespace-pre-wrap break-all max-h-48 overflow-auto font-mono text-foreground/80">
                                            {d.currentContent?.slice(0, 2000)}{(d.currentContent?.length || 0) > 2000 ? '\n... (内容过长已截断)' : ''}
                                          </pre>
                                        </div>
                                      )}
                                      {d.status === 'removed' && (
                                        <div className="p-2">
                                          <div className="text-[10px] text-red-600 dark:text-red-400 font-medium mb-1">版本内容（已删除文件）</div>
                                          <pre className="text-[11px] whitespace-pre-wrap break-all max-h-48 overflow-auto font-mono text-foreground/80">
                                            {d.versionContent?.slice(0, 2000)}{(d.versionContent?.length || 0) > 2000 ? '\n... (内容过长已截断)' : ''}
                                          </pre>
                                        </div>
                                      )}
                                      {d.status === 'modified' && (
                                        <div className="grid grid-cols-2 divide-x">
                                          <div className="p-2">
                                            <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mb-1">版本内容</div>
                                            <pre className="text-[11px] whitespace-pre-wrap break-all max-h-48 overflow-auto font-mono text-foreground/80">
                                              {d.versionContent?.slice(0, 2000)}{(d.versionContent?.length || 0) > 2000 ? '\n... (截断)' : ''}
                                            </pre>
                                          </div>
                                          <div className="p-2">
                                            <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mb-1">当前内容</div>
                                            <pre className="text-[11px] whitespace-pre-wrap break-all max-h-48 overflow-auto font-mono text-foreground/80">
                                              {d.currentContent?.slice(0, 2000)}{(d.currentContent?.length || 0) > 2000 ? '\n... (截断)' : ''}
                                            </pre>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                            {/* Summary */}
                            <div className="px-3 py-1.5 text-[10px] text-muted-foreground bg-muted/20">
                              {diffs.filter(d => d.status === 'modified').length} 个修改 · {diffs.filter(d => d.status === 'added').length} 个新增 · {diffs.filter(d => d.status === 'removed').length} 个删除 · {diffs.filter(d => d.status === 'unchanged').length} 个未变更
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Restore confirm dialog */}
      <AlertDialog open={!!restoreId} onOpenChange={(open) => { if (!open) setRestoreId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认回滚</AlertDialogTitle>
            <AlertDialogDescription>
              回滚将用该版本的内容覆盖当前文件。系统会在回滚前自动创建一个备份快照，确保可以恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} disabled={restoring}>
              {restoring ? '回滚中...' : '确认回滚'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              删除后无法恢复，确定要删除该版本吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
