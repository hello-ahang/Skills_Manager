import { Project, SourceDir } from '@/types'
import ProjectCard, { type ProjectLinkStatus, type ProjectFileEntry } from './ProjectCard'
import { Link, Unlink } from 'lucide-react'

interface ProjectLinkInfo {
  status: ProjectLinkStatus
  linkedTo?: string
}

interface ProjectListProps {
  projects: Project[]
  linkStatusMap?: Record<string, ProjectLinkInfo>
  filesMap?: Record<string, ProjectFileEntry[]>
  syncingIds?: string[]
  sourceDirs?: SourceDir[]
  onRemove: (id: string) => void
  onSync?: (id: string, sourceDirId: string) => void
  onUnlink?: (id: string) => void
}

export default function ProjectList({
  projects,
  linkStatusMap = {},
  filesMap = {},
  syncingIds = [],
  sourceDirs = [],
  onRemove,
  onSync,
  onUnlink,
}: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <svg
            className="h-8 w-8 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium">暂无项目</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          点击右上角的"添加项目"按钮来添加你的第一个项目
        </p>
      </div>
    )
  }

  // Split projects into linked and unlinked groups
  const linkedProjects = projects.filter((p) => linkStatusMap[p.id]?.status === 'linked')
  const unlinkedProjects = projects.filter((p) => linkStatusMap[p.id]?.status !== 'linked')

  const renderProjectCard = (project: Project) => {
    const linkInfo = linkStatusMap[project.id]
    return (
      <ProjectCard
        key={project.id}
        project={project}
        linkStatus={linkInfo?.status}
        linkedTo={linkInfo?.linkedTo}
        syncing={syncingIds.includes(project.id)}
        files={filesMap[project.id]}
        sourceDirs={sourceDirs}
        onRemove={onRemove}
        onSync={onSync}
        onUnlink={onUnlink}
      />
    )
  }

  // If no link status data yet (still loading), render flat list
  const hasLinkData = Object.keys(linkStatusMap).length > 0

  if (!hasLinkData) {
    return (
      <div className="grid gap-3">
        {projects.map(renderProjectCard)}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-6 min-w-0">
      {/* Left Column: Linked Projects */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Link className="h-4 w-4 text-green-500 dark:text-green-400" />
          <h3 className="text-sm font-medium text-green-700 dark:text-green-400">
            已链接项目
          </h3>
          <span className="text-xs text-muted-foreground">({linkedProjects.length})</span>
        </div>
        {linkedProjects.length > 0 ? (
          <div className="grid gap-3">
            {linkedProjects.map(renderProjectCard)}
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">暂无已链接项目</p>
          </div>
        )}
      </div>

      {/* Right Column: Unlinked Projects */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Unlink className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground">
            未链接项目
          </h3>
          <span className="text-xs text-muted-foreground">({unlinkedProjects.length})</span>
        </div>
        {unlinkedProjects.length > 0 ? (
          <div className="grid gap-3">
            {unlinkedProjects.map(renderProjectCard)}
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">所有项目已链接</p>
          </div>
        )}
      </div>
    </div>
  )
}
