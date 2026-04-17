import { useState, useEffect, useRef, useCallback } from 'react'
import { useProjects } from '@/hooks/useProjects'
import { useConfigStore } from '@/stores/configStore'
import { linksApi } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Search } from 'lucide-react'
import ProjectList from '@/components/projects/ProjectList'
import AddProjectModal from '@/components/projects/AddProjectModal'
import ConflictResolver from '@/components/links/ConflictResolver'
import type { ProjectLinkStatus } from '@/components/projects/ProjectCard'
import { toast } from 'sonner'

interface ProjectLinkInfo {
  status: ProjectLinkStatus
  linkedTo?: string
}

export default function ProjectsPage() {
  const {
    projects,
    loading,
    searchQuery,
    addProjects,
    autoDetect,
    removeProject,
    setSearchQuery,
    refreshProjects,
  } = useProjects()

  const { sourceDirs } = useConfigStore()

  const autoDetectRan = useRef(false)

  // Auto-detect preset projects on first load (after initial fetch completes)
  useEffect(() => {
    if (autoDetectRan.current || loading) return
    autoDetectRan.current = true

    autoDetect().then((result) => {
      if (result.added.length > 0) {
        toast.success(`自动检测到 ${result.added.length} 个项目：${result.added.map((p: any) => p.name).join('、')}`)
      }
    })
  }, [autoDetect, loading])

  const [showAddModal, setShowAddModal] = useState(false)
  const [linkStatusMap, setLinkStatusMap] = useState<Record<string, ProjectLinkInfo>>({})
  const [filesMap, setFilesMap] = useState<Record<string, { name: string; type: 'file' | 'directory' }[]>>({})
  const [syncingIds, setSyncingIds] = useState<string[]>([])
  const [conflict, setConflict] = useState<{ projectId: string; tool: string; projectName: string } | null>(null)

  // Extract files info from projects data
  useEffect(() => {
    const map: Record<string, { name: string; type: 'file' | 'directory' }[]> = {}
    projects.forEach((p: any) => {
      if (p.files) {
        map[p.id] = p.files
      }
    })
    setFilesMap(map)
  }, [projects])

  // Fetch link status for all projects
  const fetchLinkStatus = useCallback(async () => {
    try {
      const data = await linksApi.getStatus()
      const map: Record<string, ProjectLinkInfo> = {}
      data.projects.forEach((p: any) => {
        const link = p.links?.[0]
        if (link) {
          map[p.projectId] = {
            status: link.status as ProjectLinkStatus,
            linkedTo: link.linkedTo,
          }
        }
      })
      setLinkStatusMap(map)
    } catch {
      // Silently fail - link status is supplementary info
    }
  }, [])

  useEffect(() => {
    if (projects.length > 0) {
      fetchLinkStatus()
    }
  }, [projects, fetchLinkStatus])

  const handleAddProjects = async (items: { path: string; name?: string }[]) => {
    await addProjects(items)
    await refreshProjects()
  }

  const handleSync = async (projectId: string, sourceDirId: string) => {
    if (!sourceDirId) {
      toast.warning('请选择一个源目录')
      return
    }
    setSyncingIds((prev) => [...prev, projectId])
    try {
      const result = await linksApi.sync({ projectIds: [projectId], sourceDirId })
      const op = result.results[0]
      if (op?.status === 'success') {
        toast.success('链接创建成功')
      } else if (op?.status === 'conflict') {
        const project = projects.find((p) => p.id === projectId)
        setConflict({ projectId, tool: op.tool || '', projectName: project?.name || '' })
      } else {
        toast.error(op?.error || '同步失败')
      }
      await fetchLinkStatus()
      await refreshProjects()
    } catch {
      toast.error('同步失败')
    } finally {
      setSyncingIds((prev) => prev.filter((id) => id !== projectId))
    }
  }

  const handleUnlink = async (projectId: string) => {
    setSyncingIds((prev) => [...prev, projectId])
    try {
      await linksApi.remove({ projectIds: [projectId], restoreAsDirectory: true })
      toast.success('已解除链接')
      await fetchLinkStatus()
      await refreshProjects()
    } catch {
      toast.error('解除链接失败')
    } finally {
      setSyncingIds((prev) => prev.filter((id) => id !== projectId))
    }
  }

  const handleConflictResolution = async (strategy: 'backup-replace' | 'skip') => {
    if (!conflict) return
    setSyncingIds((prev) => [...prev, conflict.projectId])
    try {
      await linksApi.sync({
        projectIds: [conflict.projectId],
        tools: [conflict.tool],
        conflictStrategy: strategy,
      })
      toast.success(strategy === 'backup-replace' ? '已备份并替换' : '已跳过')
      setConflict(null)
      await fetchLinkStatus()
      await refreshProjects()
    } catch {
      toast.error('处理冲突失败')
    } finally {
      setSyncingIds((prev) => prev.filter((id) => id !== conflict?.projectId))
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {/* Product Guide */}
      <div className="rounded-lg border bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-4 space-y-3">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="font-medium text-red-600 dark:text-red-400 mb-1">😩 痛点</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              多个 AI 编程工具各自维护 Skills，内容分散、难以同步，重复劳动多。
            </p>
          </div>
          <div>
            <div className="font-medium text-green-600 dark:text-green-400 mb-1">💡 解法</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              统一源目录管理 Skills，通过软链接一键同步到各项目，一处维护、多处生效。
            </p>
          </div>
          <div>
            <div className="font-medium text-blue-600 dark:text-blue-400 mb-1">🚀 步骤</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              ① Skills 库添加源目录 → ② 添加项目 → ③ 绑定源目录 → ④ 绑定/解除后重启项目程序。
            </p>
          </div>
        </div>
        <div className="border-t border-blue-100 dark:border-blue-900 pt-2.5">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/70">更多亮点</span>
            <span className="flex items-center gap-1">✏️ 在线编辑 Skills 内容，实时预览</span>
            <span className="flex items-center gap-1">🤖 AI 智能生成 Skills，一键创建</span>
            <span className="flex items-center gap-1">🔍 AI 智能检查/优化 Skills</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
            <span className="font-medium text-orange-500 dark:text-orange-400">注意事项</span>
            <span>⚠️ 由于悟空 Skills 必须经过审核，因此本产品不支持悟空。</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索项目..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            添加项目
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <ProjectList
          projects={projects}
          linkStatusMap={linkStatusMap}
          filesMap={filesMap}
          syncingIds={syncingIds}
          sourceDirs={sourceDirs}
          onRemove={removeProject}
          onSync={handleSync}
          onUnlink={handleUnlink}
        />
      )}

      <AddProjectModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onAdd={handleAddProjects}
        onRefresh={refreshProjects}
        existingPaths={projects.map((p) => p.path)}
      />

      {/* Conflict Resolver */}
      <ConflictResolver
        open={!!conflict}
        onOpenChange={(open) => !open && setConflict(null)}
        projectName={conflict?.projectName || ''}
        tool={conflict?.tool || ''}
        onResolve={handleConflictResolution}
      />
    </div>
  )
}
