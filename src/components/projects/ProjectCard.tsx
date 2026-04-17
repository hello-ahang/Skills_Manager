import { useState } from 'react'
import { Project, SourceDir } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { FolderOpen, Trash2, Link, Unlink, RefreshCw, FileText, Folder, ChevronDown, ChevronUp, Sparkles, Eye } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import ProjectFileBrowser from '@/components/projects/ProjectFileBrowser'

export type ProjectLinkStatus = 'linked' | 'unlinked' | 'missing' | 'broken' | 'unknown'

export interface ProjectFileEntry {
  name: string
  type: 'file' | 'directory'
  skillName?: string
  skillDescription?: string
}

interface ProjectCardProps {
  project: Project
  linkStatus?: ProjectLinkStatus
  linkedTo?: string
  syncing?: boolean
  files?: ProjectFileEntry[]
  sourceDirs?: SourceDir[]
  onRemove: (id: string) => void
  onSync?: (id: string, sourceDirId: string) => void
  onUnlink?: (id: string) => void
}

const MAX_VISIBLE_FILES = 5

/**
 * Resolve the source dir name from linkedTo path by matching against sourceDirs.
 */
function resolveSourceDirName(linkedTo: string | undefined, sourceDirs: SourceDir[]): string | null {
  if (!linkedTo || sourceDirs.length === 0) return null
  const found = sourceDirs.find(sd => linkedTo === sd.path || linkedTo.startsWith(sd.path + '/'))
  return found ? found.name : null
}

export default function ProjectCard({
  project,
  linkStatus = 'unknown',
  linkedTo,
  syncing = false,
  files = [],
  sourceDirs = [],
  onRemove,
  onSync,
  onUnlink,
}: ProjectCardProps) {
  const isLinked = linkStatus === 'linked'
  const [expanded, setExpanded] = useState(false)
  const [showSourceSelect, setShowSourceSelect] = useState(false)
  const [browseFolder, setBrowseFolder] = useState<{ path: string; name: string } | null>(null)

  const visibleFiles = expanded ? files : files.slice(0, MAX_VISIBLE_FILES)
  const hasMore = files.length > MAX_VISIBLE_FILES

  const boundSourceName = resolveSourceDirName(linkedTo, sourceDirs)

  const handleSyncClick = () => {
    if (!onSync) return
    if (sourceDirs.length === 0) {
      return
    }
    if (sourceDirs.length === 1) {
      // Only one source dir, sync directly
      onSync(project.id, sourceDirs[0].id)
    } else {
      // Multiple source dirs, show selection dialog
      setShowSourceSelect(true)
    }
  }

  const handleSelectSourceDir = (sourceDirId: string) => {
    setShowSourceSelect(false)
    onSync?.(project.id, sourceDirId)
  }

  return (
    <>
      <Card className={cn(
        'transition-shadow hover:shadow-md border-l-4 overflow-hidden',
        isLinked
          ? 'border-l-green-500 dark:border-l-green-400'
          : 'border-l-gray-300 dark:border-l-gray-600'
      )}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <FolderOpen className={cn(
                'mt-0.5 h-5 w-5 shrink-0',
                isLinked ? 'text-green-500 dark:text-green-400' : 'text-muted-foreground'
              )} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium truncate">{project.name}</h3>
                  {files.length > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 font-normal">
                      {files.length} 个文件
                    </Badge>
                  )}
                  {linkStatus !== 'unknown' && (
                    isLinked ? (
                      <Badge variant="default" className="text-[10px] gap-1 px-1.5 py-0 shrink-0">
                        <Link className="h-2.5 w-2.5" />
                        已链接
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0 shrink-0">
                        <Unlink className="h-2.5 w-2.5" />
                        未链接
                      </Badge>
                    )
                  )}
                  {boundSourceName && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 font-normal bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                      {boundSourceName}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5 break-all line-clamp-1" title={project.path}>
                  {project.path}
                </p>

                {/* Skills File List */}
                {files.length > 0 && (
                  <div className="mt-2 rounded-md border bg-muted/30 p-2">
                    <TooltipProvider delayDuration={300}>
                    <div className="space-y-0.5">
                      {visibleFiles.map((file) => {
                        const hasSkillInfo = file.type === 'directory' && (file.skillName || file.skillDescription)

                        const fileRow = (
                          <div
                            key={file.name}
                            className={cn(
                              "flex items-center gap-1.5 py-0.5 rounded-sm px-1 -mx-1",
                              file.type === 'directory'
                                ? "hover:bg-muted/80 cursor-pointer"
                                : hasSkillInfo
                                  ? "hover:bg-muted/80 cursor-default"
                                  : ""
                            )}
                            onClick={file.type === 'directory' ? () => setBrowseFolder({ path: `${project.path}/${file.name}`, name: file.name }) : undefined}
                          >
                            {file.type === 'directory' ? (
                              <Folder className="h-3.5 w-3.5 shrink-0 text-blue-500 dark:text-blue-400" />
                            ) : (
                              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            )}
                            <span className="text-xs truncate flex-1">
                              {file.name}{file.type === 'directory' ? '/' : ''}
                            </span>
                            {hasSkillInfo && (
                              <Sparkles className="h-3 w-3 shrink-0 text-amber-500 dark:text-amber-400" />
                            )}
                            {file.type === 'directory' && (
                              <button
                                className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setBrowseFolder({ path: `${project.path}/${file.name}`, name: file.name })
                                }}
                              >
                                <Eye className="h-3 w-3" />
                                查看
                              </button>
                            )}
                          </div>
                        )

                        if (hasSkillInfo) {
                          return (
                            <Tooltip key={file.name}>
                              <TooltipTrigger asChild>
                                {fileRow}
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs p-2.5 space-y-1 bg-gray-900 border-gray-700">
                                {file.skillName && (
                                  <p className="text-xs font-medium text-white">{file.skillName}</p>
                                )}
                                {file.skillDescription && (
                                  <p className="text-[11px] text-gray-400 leading-relaxed">{file.skillDescription}</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          )
                        }

                        return fileRow
                      })}
                    </div>
                    </TooltipProvider>
                    {hasMore && (
                      <button
                        className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        onClick={() => setExpanded(!expanded)}
                      >
                        {expanded ? (
                          <>
                            <ChevronUp className="h-3 w-3" />
                            收起
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3" />
                            展开更多 (共 {files.length} 个)
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
                {files.length === 0 && linkStatus !== 'unknown' && (
                  <p className="mt-2 text-xs text-muted-foreground italic">暂无 Skills 文件</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              {onSync && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  disabled={syncing || sourceDirs.length === 0}
                  onClick={handleSyncClick}
                >
                  {syncing ? (
                    <RefreshCw className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {isLinked ? '重新绑定' : '绑定'}
                </Button>
              )}
              {onUnlink && isLinked && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  disabled={syncing}
                  onClick={() => onUnlink(project.id)}
                >
                  解绑
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-xs text-destructive hover:text-destructive"
                  >
                    删除
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认删除</AlertDialogTitle>
                    <AlertDialogDescription>
                      确定要从管理列表中移除项目 "{project.name}" 吗？这不会删除项目文件。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onRemove(project.id)}>
                      确认删除
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Source Dir Selection Dialog */}
      <Dialog open={showSourceSelect} onOpenChange={setShowSourceSelect}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>选择源目录</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <p className="text-sm text-muted-foreground mb-3">
              为项目 <span className="font-medium text-foreground">{project.name}</span> 选择要绑定的源目录：
            </p>
            {sourceDirs.map(sd => (
              <button
                key={sd.id}
                className="w-full flex items-center gap-3 rounded-md border p-3 text-left hover:bg-accent transition-colors cursor-pointer"
                onClick={() => handleSelectSourceDir(sd.id)}
              >
                <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{sd.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{sd.path}</div>
                </div>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSourceSelect(false)}>
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project File Browser Dialog */}
      {browseFolder && (
        <ProjectFileBrowser
          open={!!browseFolder}
          onOpenChange={(open) => { if (!open) setBrowseFolder(null) }}
          folderPath={browseFolder.path}
          folderName={browseFolder.name}
        />
      )}
    </>
  )
}
