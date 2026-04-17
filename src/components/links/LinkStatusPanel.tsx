import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'
import { FolderOpen, Link, Unlink } from 'lucide-react'

interface LinkInfo {
  tool: string
  status: string
  targetPath: string
  linkedTo?: string
}

interface ProjectLinkStatus {
  projectId: string
  projectName: string
  projectPath: string
  links: LinkInfo[]
  linkedTo?: string
}

interface LinkStatusPanelProps {
  projects: ProjectLinkStatus[]
  selectedIds: string[]
  onToggleSelect: (id: string) => void
}

export default function LinkStatusPanel({
  projects,
  selectedIds,
  onToggleSelect,
}: LinkStatusPanelProps) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-lg font-medium">暂无项目</p>
        <p className="mt-1 text-sm text-muted-foreground">
          请先在项目管理中添加项目
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {projects.map((project) => {
        const isSelected = selectedIds.includes(project.projectId)
        // Determine overall link status: check if the project path is a symlink
        const isLinked = project.links.some((l) => l.status === 'linked')
        const linkedTo = project.links.find((l) => l.linkedTo)?.linkedTo

        return (
          <Card key={project.projectId}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleSelect(project.projectId)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{project.projectName}</span>
                    {isLinked ? (
                      <Badge variant="default" className="text-xs gap-1">
                        <Link className="h-3 w-3" />
                        已链接
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Unlink className="h-3 w-3" />
                        未链接
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {project.projectPath}
                  </p>
                  {linkedTo && (
                    <p className="text-xs text-muted-foreground mt-1">
                      → {linkedTo}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
