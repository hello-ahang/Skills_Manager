import { useState, useCallback, useMemo } from 'react'
import { FileTreeNode } from '@/types'
import { cn } from '@/lib/utils'
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, FolderCheck, FolderOpenDot, Trash2, Plus, ChevronsUpDown, ChevronsDownUp, FilePlus, FolderPlus, Pencil, MoreHorizontal, Wand2, Download, Tag, X, History, Send } from 'lucide-react'
import RelatedSkillsBadge from '@/components/skills/RelatedSkillsBadge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

export interface SkillHealthSummary {
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  issuesCount: number
}

interface FileTreeProps {
  nodes: FileTreeNode[]
  selectedFile: string | null
  onSelectFile: (path: string) => void
  onDeleteFile: (path: string) => void
  onDeleteDir?: (dirPath: string) => void
  onCreateFile?: (dirPath: string) => void
  onCreateDir?: (dirPath: string) => void
  onRename?: (path: string, currentName: string) => void
  onAIOptimize?: (dirPath: string) => void
  onExport?: (dirPath: string) => void
  skillAliases?: Record<string, string>
  onSetAlias?: (dirPath: string, currentAlias?: string) => void
  onRemoveAlias?: (dirPath: string) => void
  onVersionHistory?: (dirPath: string, dirName: string) => void
  onPublishTo?: (dirPath: string, dirName: string) => void
  /** Skill 路径 -> 健康度摘要，用于在 Skill 目录节点旁展示徽章 */
  healthMap?: Record<string, SkillHealthSummary>
  /** 点击健康度徽章时触发，传入 Skill 目录路径 */
  onShowHealth?: (dirPath: string) => void
  /** 点击相关 Skill 跳转回调 */
  onJumpRelated?: (skillName: string) => void
}

interface TreeNodeProps {
  node: FileTreeNode
  depth: number
  selectedFile: string | null
  expandedPaths: Set<string>
  onToggleExpand: (path: string) => void
  onSelectFile: (path: string) => void
  onDeleteFile: (path: string) => void
  onDeleteDir?: (dirPath: string) => void
  healthMap?: Record<string, SkillHealthSummary>
  onShowHealth?: (dirPath: string) => void
  onJumpRelated?: (skillName: string) => void
  knownSkillNames?: Set<string>
  onCreateFile?: (dirPath: string) => void
  onCreateDir?: (dirPath: string) => void
  onRename?: (path: string, currentName: string) => void
  onAIOptimize?: (dirPath: string) => void
  onExport?: (dirPath: string) => void
  skillAliases?: Record<string, string>
  onSetAlias?: (dirPath: string, currentAlias?: string) => void
  onRemoveAlias?: (dirPath: string) => void
  onVersionHistory?: (dirPath: string, dirName: string) => void
  onPublishTo?: (dirPath: string, dirName: string) => void
}

function TreeNode({ node, depth, selectedFile, expandedPaths, onToggleExpand, onSelectFile, onDeleteFile, onDeleteDir, onCreateFile, onCreateDir, onRename, onAIOptimize, onExport, skillAliases, onSetAlias, onRemoveAlias, onVersionHistory, onPublishTo, healthMap, onShowHealth, onJumpRelated, knownSkillNames }: TreeNodeProps) {
  const isSelected = node.path === selectedFile
  const isDirectory = node.type === 'directory'
  const expanded = expandedPaths.has(node.path)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const alias = isDirectory && skillAliases?.[node.path]

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 rounded-md px-2 py-1 text-sm cursor-pointer hover:bg-accent',
          isSelected && 'bg-accent text-accent-foreground'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          if (isDirectory) {
            onToggleExpand(node.path)
          } else {
            onSelectFile(node.path)
          }
        }}
      >
        {isDirectory ? (
          <>
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            {node.isValidSkill ? (
              expanded ? (
                <FolderOpenDot className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
              ) : (
                <FolderCheck className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
              )
            ) : (
              expanded ? (
                <FolderOpen className="h-4 w-4 shrink-0 text-blue-500" />
              ) : (
                <Folder className="h-4 w-4 shrink-0 text-blue-500" />
              )
            )}
          </>
        ) : (
          <>
            <span className="w-3.5" />
            <File className="h-4 w-4 shrink-0 text-muted-foreground" />
          </>
        )}
        <div className="truncate min-w-0" style={{ flex: '1 1 0', maxWidth: 'calc(100% - 32px)' }}>
          {alias ? (
            <>
              <span className="truncate block text-violet-600 dark:text-violet-400 font-medium" title={`别名: ${alias}（原始名: ${node.name}）`}>
                {alias}
              </span>
              <span className="truncate block text-[10px] leading-tight text-muted-foreground/50 font-normal">
                {node.name}
              </span>
            </>
          ) : (
            <span className="truncate block">{node.name}</span>
          )}
          {isDirectory && node.description && (
            <span
              className="truncate block text-[10px] leading-tight text-muted-foreground/70 font-normal"
              title={node.description}
            >
              {node.description}
            </span>
          )}
          {isDirectory && node.version && depth === 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] leading-tight text-primary/70 font-mono">
              <Tag className="h-2.5 w-2.5" />
              v{node.version}
            </span>
          )}
        </div>
        {isDirectory && node.isValidSkill && depth === 0 && node.relatedSkills && node.relatedSkills.length > 0 && (
          <RelatedSkillsBadge
            related={node.relatedSkills}
            knownSkillNames={knownSkillNames}
            onJump={onJumpRelated}
          />
        )}
        {isDirectory && node.isValidSkill && depth === 0 && healthMap?.[node.path] && onShowHealth && (() => {
          const h = healthMap[node.path]
          const colorMap: Record<string, string> = {
            A: 'text-green-700 bg-green-100 hover:bg-green-200 dark:text-green-300 dark:bg-green-950/50',
            B: 'text-blue-700 bg-blue-100 hover:bg-blue-200 dark:text-blue-300 dark:bg-blue-950/50',
            C: 'text-yellow-700 bg-yellow-100 hover:bg-yellow-200 dark:text-yellow-300 dark:bg-yellow-950/50',
            D: 'text-orange-700 bg-orange-100 hover:bg-orange-200 dark:text-orange-300 dark:bg-orange-950/50',
            F: 'text-red-700 bg-red-100 hover:bg-red-200 dark:text-red-300 dark:bg-red-950/50',
          }
          return (
            <button
              className={cn(
                'inline-flex items-center gap-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold cursor-pointer transition-colors',
                colorMap[h.grade] || colorMap.C,
              )}
              title={`健康度 ${h.score}/100，${h.issuesCount} 个问题`}
              onClick={(e) => { e.stopPropagation(); onShowHealth(node.path) }}
            >
              {h.grade} {h.score}
            </button>
          )
        })()}
        {isDirectory && node.isValidSkill && depth === 0 && onAIOptimize && (
          <button
            className="inline-flex items-center gap-1 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 dark:text-purple-300 dark:bg-purple-950/50 dark:hover:bg-purple-900/60 cursor-pointer transition-colors"
            onClick={(e) => { e.stopPropagation(); onAIOptimize(node.path) }}
          >
            <Wand2 className="h-3 w-3" />
            AI 优化
          </button>
        )}
        <div className="shrink-0" style={{ width: '24px', height: '24px' }} onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center justify-center w-full h-full rounded border border-border bg-muted hover:bg-accent cursor-pointer outline-none">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="right">
                {isDirectory && onCreateFile && (
                  <DropdownMenuItem onClick={() => onCreateFile(node.path)}>
                    <FilePlus className="mr-2 h-3.5 w-3.5" />
                    新建文件
                  </DropdownMenuItem>
                )}
                {isDirectory && onCreateDir && (
                  <DropdownMenuItem onClick={() => onCreateDir(node.path)}>
                    <FolderPlus className="mr-2 h-3.5 w-3.5" />
                    新建文件夹
                  </DropdownMenuItem>
                )}
                {isDirectory && (onCreateFile || onCreateDir) && (
                  <DropdownMenuSeparator />
                )}
                {onRename && (
                  <DropdownMenuItem onClick={() => onRename(node.path, node.name)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    重命名
                  </DropdownMenuItem>
                )}
                {isDirectory && node.isValidSkill && depth === 0 && onSetAlias && (
                  <DropdownMenuItem onClick={() => onSetAlias(node.path, alias || undefined)}>
                    <Tag className="mr-2 h-3.5 w-3.5" />
                    {alias ? '修改别名' : '设置别名'}
                  </DropdownMenuItem>
                )}
                {isDirectory && node.isValidSkill && depth === 0 && alias && onRemoveAlias && (
                  <DropdownMenuItem onClick={() => onRemoveAlias(node.path)}>
                    <X className="mr-2 h-3.5 w-3.5" />
                    清除别名
                  </DropdownMenuItem>
                )}
                {isDirectory && node.isValidSkill && depth === 0 && onVersionHistory && (
                  <DropdownMenuItem onClick={() => onVersionHistory(node.path, node.name)}>
                    <History className="mr-2 h-3.5 w-3.5" />
                    版本历史
                  </DropdownMenuItem>
                )}
                {isDirectory && node.isValidSkill && depth === 0 && onExport && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onExport(node.path)}>
                      <Download className="mr-2 h-3.5 w-3.5" />
                      导出
                    </DropdownMenuItem>
                  </>
                )}
                {isDirectory && node.isValidSkill && depth === 0 && onPublishTo && (
                  <DropdownMenuItem onClick={() => onPublishTo(node.path, node.name)}>
                    <Send className="mr-2 h-3.5 w-3.5" />
                    发布到...
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  删除{isDirectory ? '文件夹' : '文件'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>

        {/* Delete confirmation dialog */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除</AlertDialogTitle>
              <AlertDialogDescription>
                {isDirectory
                  ? `确定要删除文件夹 "${node.name}" 及其所有内容吗？此操作不可撤销。`
                  : `确定要删除文件 "${node.name}" 吗？此操作不可撤销。`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (isDirectory && onDeleteDir) {
                    onDeleteDir(node.path)
                  } else {
                    onDeleteFile(node.path)
                  }
                  setShowDeleteConfirm(false)
                }}
              >
                确认删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {isDirectory && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedFile={selectedFile}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
              onSelectFile={onSelectFile}
              onDeleteFile={onDeleteFile}
              onDeleteDir={onDeleteDir}
              onCreateFile={onCreateFile}
              onCreateDir={onCreateDir}
              onRename={onRename}
              onAIOptimize={onAIOptimize}
              onExport={onExport}
              skillAliases={skillAliases}
              onSetAlias={onSetAlias}
              onRemoveAlias={onRemoveAlias}
              onVersionHistory={onVersionHistory}
              onPublishTo={onPublishTo}
              healthMap={healthMap}
              onShowHealth={onShowHealth}
              onJumpRelated={onJumpRelated}
              knownSkillNames={knownSkillNames}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Collect all directory paths from tree
function collectDirPaths(nodes: FileTreeNode[]): string[] {
  const paths: string[] = []
  for (const node of nodes) {
    if (node.type === 'directory') {
      paths.push(node.path)
      if (node.children) {
        paths.push(...collectDirPaths(node.children))
      }
    }
  }
  return paths
}

// Collect top-level directory paths (depth < 2)
function collectDefaultExpanded(nodes: FileTreeNode[], depth = 0): string[] {
  const paths: string[] = []
  for (const node of nodes) {
    if (node.type === 'directory' && depth < 2) {
      paths.push(node.path)
      if (node.children) {
        paths.push(...collectDefaultExpanded(node.children, depth + 1))
      }
    }
  }
  return paths
}

export default function FileTree({ nodes, selectedFile, onSelectFile, onDeleteFile, onDeleteDir, onCreateFile, onCreateDir, onRename, onAIOptimize, onExport, skillAliases, onSetAlias, onRemoveAlias, onVersionHistory, onPublishTo, healthMap, onShowHealth, onJumpRelated }: FileTreeProps) {
  // Default: all directories collapsed
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const allDirPaths = useMemo(() => collectDirPaths(nodes), [nodes])

  // Collect all known skill names for RelatedSkillsBadge validation
  const knownSkillNames = useMemo(() => {
    const names = new Set<string>()
    for (const node of nodes) {
      if (node.type === 'directory' && node.isValidSkill) {
        names.add(node.name)
      }
    }
    return names
  }, [nodes])

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    setExpandedPaths(new Set(allDirPaths))
  }, [allDirPaths])

  const collapseAll = useCallback(() => {
    setExpandedPaths(new Set())
  }, [])

  // Show "收起" when any directory is expanded, "展开" when all collapsed
  const showCollapse = expandedPaths.size > 0

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground">
        <p>暂无文件</p>
        <p className="mt-1 text-xs">请先在设置中配置 Skills 源目录</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-end mb-1 px-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground"
          onClick={showCollapse ? collapseAll : expandAll}
          title={showCollapse ? '全部收起' : '全部展开'}
        >
          {showCollapse ? (
            <>
              <ChevronsDownUp className="mr-1 h-3 w-3" />
              收起
            </>
          ) : (
            <>
              <ChevronsUpDown className="mr-1 h-3 w-3" />
              展开
            </>
          )}
        </Button>
      </div>
      <div className="space-y-0.5">
        {nodes.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            selectedFile={selectedFile}
            expandedPaths={expandedPaths}
            onToggleExpand={toggleExpand}
            onSelectFile={onSelectFile}
            onDeleteFile={onDeleteFile}
            onDeleteDir={onDeleteDir}
            onCreateFile={onCreateFile}
            onCreateDir={onCreateDir}
            onAIOptimize={onAIOptimize}
            onExport={onExport}
            onRename={onRename}
            skillAliases={skillAliases}
            onSetAlias={onSetAlias}
            onRemoveAlias={onRemoveAlias}
            onVersionHistory={onVersionHistory}
            onPublishTo={onPublishTo}
            healthMap={healthMap}
            onShowHealth={onShowHealth}
            onJumpRelated={onJumpRelated}
            knownSkillNames={knownSkillNames}
          />
        ))}
      </div>
    </div>
  )
}
