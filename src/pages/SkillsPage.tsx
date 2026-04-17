import { useState, useCallback } from 'react'
import { useSkills } from '@/hooks/useSkills'
import { useConfigStore } from '@/stores/configStore'
import { useSkillsStore } from '@/stores/skillsStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sparkles, Search, Settings2, Plus, Trash2, Pencil } from 'lucide-react'
import FileTree from '@/components/skills/FileTree'
import SkillEditor from '@/components/skills/Editor'
import AISkillGenerator from '@/components/skills/AISkillGenerator'
import AISkillOptimizer from '@/components/skills/AISkillOptimizer'
import VersionHistoryDialog from '@/components/skills/VersionHistoryDialog'
import SearchResults from '@/components/skills/SearchResults'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { skillsApi } from '@/api/client'
import { toast } from 'sonner'
import { v4 as uuidv4 } from 'uuid'
import type { SourceDir, FileTreeNode } from '@/types'

/** Count top-level (first-level) directories and valid skills only */
function computeTreeStats(tree: FileTreeNode[]) {
  let dirCount = 0
  let validSkillCount = 0

  for (const node of tree) {
    if (node.type === 'directory') {
      dirCount++
      if (node.isValidSkill) {
        validSkillCount++
      }
    }
  }
  return { dirCount, validSkillCount }
}

function SourceDirStats({ tree }: { tree: FileTreeNode[] }) {
  const { dirCount, validSkillCount } = computeTreeStats(tree)
  return (
    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1">
        📁 {dirCount} 个文件夹
      </span>
      <span className="flex items-center gap-1">
        <Sparkles className="h-3 w-3 text-amber-500" />
        {validSkillCount} 个有效 Skill
      </span>
    </div>
  )
}

export default function SkillsPage() {
  const {
    tree,
    sourceDir,
    selectedFile,
    fileContent,
    originalContent,
    saving,
    unsavedChanges,
    editorMode,
    searchQuery,
    searchResults,
    treeLoading,
    fileLoading,
    selectFile,
    updateContent,
    saveFile,
    setEditorMode,
    enterEditMode,
    cancelEdit,
    createFile,
    deleteFile,
    searchFiles,
    refreshTree,
  } = useSkills()

  const { sourceDirs, activeSourceDirId, updateConfig, setActiveSourceDir } = useConfigStore()

  const [showAIGenerate, setShowAIGenerate] = useState(false)
  const [optimizeDirPath, setOptimizeDirPath] = useState('')
  const [showAIOptimize, setShowAIOptimize] = useState(false)
  const [showSourceManage, setShowSourceManage] = useState(false)
  const [showAddSource, setShowAddSource] = useState(false)
  const [showEditSource, setShowEditSource] = useState(false)
  const [editingSource, setEditingSource] = useState<SourceDir | null>(null)
  const [newSourceName, setNewSourceName] = useState('')
  const [newSourcePath, setNewSourcePath] = useState('')
  const [sourceError, setSourceError] = useState('')
  const [showNewFile, setShowNewFile] = useState(false)
  const [showNewDir, setShowNewDir] = useState(false)
  const [showRename, setShowRename] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [newFileParent, setNewFileParent] = useState('')
  const [newFileError, setNewFileError] = useState('')
  const [newDirName, setNewDirName] = useState('')
  const [newDirParent, setNewDirParent] = useState('')
  const [newDirError, setNewDirError] = useState('')
  const [renamePath, setRenamePath] = useState('')
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState('')
  const [activeTab, setActiveTab] = useState<string>('files')

  // 版本历史
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [versionSkillPath, setVersionSkillPath] = useState('')
  const [versionSkillName, setVersionSkillName] = useState('')

  const handleVersionHistory = (dirPath: string, dirName: string) => {
    setVersionSkillPath(dirPath)
    setVersionSkillName(dirName)
    setShowVersionHistory(true)
  }

  // 别名功能
  const { skillAliases, setSkillAlias, removeSkillAlias } = useSkillsStore()
  const [showAliasDialog, setShowAliasDialog] = useState(false)
  const [aliasDirPath, setAliasDirPath] = useState('')
  const [aliasValue, setAliasValue] = useState('')

  const handleSetAlias = (dirPath: string, currentAlias?: string) => {
    setAliasDirPath(dirPath)
    setAliasValue(currentAlias || '')
    setShowAliasDialog(true)
  }

  const handleConfirmAlias = () => {
    if (aliasValue.trim()) {
      setSkillAlias(aliasDirPath, aliasValue.trim())
      toast.success('别名已设置')
    }
    setShowAliasDialog(false)
    setAliasDirPath('')
    setAliasValue('')
  }

  const handleRemoveAlias = (dirPath: string) => {
    removeSkillAlias(dirPath)
    toast.success('别名已清除')
  }

  const handleCreateFile = async () => {
    if (!newFileName.trim()) {
      setNewFileError('请输入文件名')
      return
    }
    try {
      const fullPath = `${newFileParent}/${newFileName.trim()}`
      await createFile(fullPath)
      setShowNewFile(false)
      setNewFileName('')
      setNewFileParent('')
      setNewFileError('')
    } catch (err) {
      setNewFileError(err instanceof Error ? err.message : '创建失败')
    }
  }

  const handleCreateInDir = (dirPath: string) => {
    setNewFileParent(dirPath)
    setNewFileName('')
    setNewFileError('')
    setShowNewFile(true)
  }

  const handleCreateDirInDir = (dirPath: string) => {
    setNewDirParent(dirPath)
    setNewDirName('')
    setNewDirError('')
    setShowNewDir(true)
  }

  const handleCreateDir = async () => {
    if (!newDirName.trim()) {
      setNewDirError('请输入文件夹名称')
      return
    }
    try {
      const fullPath = `${newDirParent}/${newDirName.trim()}`
      await skillsApi.createDirectory(fullPath)
      toast.success('文件夹创建成功')
      setShowNewDir(false)
      setNewDirName('')
      setNewDirError('')
      await refreshTree()
    } catch (err) {
      setNewDirError(err instanceof Error ? err.message : '创建失败')
    }
  }

  const handleDeleteDir = async (dirPath: string) => {
    try {
      await skillsApi.deleteDirectory(dirPath)
      toast.success('文件夹已删除')
      await refreshTree()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败')
    }
  }

  const handleRenameStart = (path: string, currentName: string) => {
    setRenamePath(path)
    setRenameValue(currentName)
    setRenameError('')
    setShowRename(true)
  }

  const handleRename = async () => {
    if (!renameValue.trim()) {
      setRenameError('请输入名称')
      return
    }
    try {
      await skillsApi.rename(renamePath, renameValue.trim())
      toast.success('重命名成功')
      setShowRename(false)
      setRenamePath('')
      setRenameValue('')
      setRenameError('')
      await refreshTree()
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : '重命名失败')
    }
  }

  const handleSwitchSourceDir = useCallback(async (id: string) => {
    await setActiveSourceDir(id)
    await refreshTree(id)
  }, [setActiveSourceDir, refreshTree])

  const handleAddSource = async () => {
    if (!newSourceName.trim() || !newSourcePath.trim()) {
      setSourceError('名称和路径不能为空')
      return
    }
    try {
      const newDir: SourceDir = {
        id: uuidv4(),
        name: newSourceName.trim(),
        path: newSourcePath.trim(),
      }
      const updated = [...sourceDirs, newDir]
      await updateConfig({
        sourceDirs: updated,
        activeSourceDirId: updated.length === 1 ? newDir.id : activeSourceDirId || newDir.id,
      })
      toast.success('源目录已添加')
      setShowAddSource(false)
      setNewSourceName('')
      setNewSourcePath('')
      setSourceError('')
      // If this is the first or newly active, refresh tree
      if (updated.length === 1 || !activeSourceDirId) {
        await refreshTree(newDir.id)
      }
    } catch (error) {
      setSourceError('添加失败')
    }
  }

  const handleEditSource = async () => {
    if (!editingSource) return
    if (!newSourceName.trim() || !newSourcePath.trim()) {
      setSourceError('名称和路径不能为空')
      return
    }
    try {
      const updated = sourceDirs.map(s =>
        s.id === editingSource.id
          ? { ...s, name: newSourceName.trim(), path: newSourcePath.trim() }
          : s
      )
      await updateConfig({ sourceDirs: updated })
      toast.success('源目录已更新')
      setShowEditSource(false)
      setEditingSource(null)
      setNewSourceName('')
      setNewSourcePath('')
      setSourceError('')
      // If editing the active one, refresh tree
      if (editingSource.id === activeSourceDirId) {
        await refreshTree(editingSource.id)
      }
    } catch (error) {
      setSourceError('更新失败')
    }
  }

  const handleDeleteSource = async (id: string) => {
    const updated = sourceDirs.filter(s => s.id !== id)
    const newActiveId = activeSourceDirId === id
      ? (updated.length > 0 ? updated[0].id : '')
      : activeSourceDirId
    try {
      await updateConfig({ sourceDirs: updated, activeSourceDirId: newActiveId })
      toast.success('源目录已删除')
      if (newActiveId && newActiveId !== activeSourceDirId) {
        await refreshTree(newActiveId)
      } else if (!newActiveId) {
        await refreshTree()
      }
    } catch (error) {
      toast.error('删除失败')
    }
  }

  return (
    <div className="flex h-[calc(100vh-9.5rem)] gap-0 -m-6">
      {/* Left Panel: File Tree & Search */}
      <div className="flex w-80 flex-col border-r">
        {/* Source Dir Selector */}
        <div className="border-b px-3 py-2 space-y-1.5">
          <div className="flex items-center gap-1">
            {sourceDirs.length > 0 ? (
              <Select value={activeSourceDirId} onValueChange={handleSwitchSourceDir}>
                <SelectTrigger className="h-7 flex-1 min-w-0 text-xs">
                  <SelectValue placeholder="选择源目录" />
                </SelectTrigger>
                <SelectContent>
                  {sourceDirs.map(sd => (
                    <SelectItem key={sd.id} value={sd.id} className="text-xs">
                      {sd.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="flex-1 text-xs text-muted-foreground">未配置源目录</span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs shrink-0"
              onClick={() => setShowSourceManage(true)}
            >
              <Settings2 className="mr-1 h-3 w-3" />
              管理
            </Button>
          </div>
          {/* Source Dir Stats */}
          {tree.length > 0 && (
            <SourceDirStats tree={tree} />
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          <div className="border-b px-2 pt-2">
            <TabsList className="w-full">
              <TabsTrigger value="files" className="flex-1 text-xs">文件</TabsTrigger>
              <TabsTrigger value="search" className="flex-1 text-xs">搜索</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="files" className="flex-1 flex flex-col mt-0 overflow-hidden min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
              <div className="p-2">
                <FileTree
                  nodes={tree}
                  selectedFile={selectedFile}
                  onSelectFile={selectFile}
                  onDeleteFile={deleteFile}
                  onDeleteDir={handleDeleteDir}
                  onCreateFile={handleCreateInDir}
                  onCreateDir={handleCreateDirInDir}
                  onRename={handleRenameStart}
                  onAIOptimize={(dirPath) => {
                    setOptimizeDirPath(dirPath)
                    setShowAIOptimize(true)
                  }}
                  onExport={async (dirPath) => {
                    try {
                      const folderName = dirPath.split('/').pop() || 'skill'
                      const response = await fetch('/api/tools/export', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ paths: [dirPath] }),
                      })
                      if (!response.ok) throw new Error('导出失败')
                      const blob = await response.blob()
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `${folderName}.zip`
                      a.click()
                      URL.revokeObjectURL(url)
                      toast.success(`已导出 ${folderName}`)
                    } catch {
                      toast.error('导出失败')
                    }
                  }}
                  skillAliases={skillAliases}
                  onSetAlias={handleSetAlias}
                  onRemoveAlias={handleRemoveAlias}
                  onVersionHistory={handleVersionHistory}
                />
              </div>
            </div>
            <Separator />
            <div className="shrink-0 p-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-center text-xs gap-1.5 border-dashed border-amber-300 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950"
                onClick={() => setShowAIGenerate(true)}
              >
                <Sparkles className="h-3.5 w-3.5" />
                AI 生成技能
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="search" className="flex-1 flex flex-col mt-0 overflow-hidden min-h-0">
            <div className="p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索 Skills 内容..."
                  value={searchQuery}
                  onChange={(e) => searchFiles(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="p-2">
                {searchQuery ? (
                  <SearchResults results={searchResults} onSelectFile={selectFile} />
                ) : (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    输入关键词搜索所有 Skills 文件
                  </p>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Right Panel: Editor */}
      <div className="flex-1">
        {fileLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <span className="text-sm text-muted-foreground">加载文件中...</span>
            </div>
          </div>
        ) : (
          <SkillEditor
            content={fileContent}
            originalContent={originalContent}
            filePath={selectedFile}
            saving={saving}
            unsavedChanges={unsavedChanges}
            editorMode={editorMode}
            onChange={updateContent}
            onSave={saveFile}
            onEnterEdit={enterEditMode}
            onCancelEdit={cancelEdit}
            onSetMode={setEditorMode}
          />
        )}
      </div>

      {/* New File Dialog */}
      <Dialog open={showNewFile} onOpenChange={setShowNewFile}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建文件</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>父目录</Label>
              <code className="block rounded bg-muted px-2 py-1 text-xs">
                {newFileParent}
              </code>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filename">文件名</Label>
              <Input
                id="filename"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="new-skill.md"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFile()
                }}
              />
            </div>
            {newFileError && (
              <p className="text-sm text-destructive">{newFileError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFile(false)}>
              取消
            </Button>
            <Button onClick={handleCreateFile}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Directory Dialog */}
      <Dialog open={showNewDir} onOpenChange={setShowNewDir}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建文件夹</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>父目录</Label>
              <code className="block rounded bg-muted px-2 py-1 text-xs">
                {newDirParent}
              </code>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dirname">文件夹名称</Label>
              <Input
                id="dirname"
                value={newDirName}
                onChange={(e) => setNewDirName(e.target.value)}
                placeholder="new-skill-folder"
              />
            </div>
            {newDirError && (
              <p className="text-sm text-destructive">{newDirError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDir(false)}>
              取消
            </Button>
            <Button onClick={handleCreateDir}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={showRename} onOpenChange={setShowRename}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>重命名</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="renameval">新名称</Label>
              <Input
                id="renameval"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="输入新名称"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename()
                }}
              />
            </div>
            {renameError && (
              <p className="text-sm text-destructive">{renameError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRename(false)}>
              取消
            </Button>
            <Button onClick={handleRename}>确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Source Dir Management Dialog */}
      <Dialog open={showSourceManage} onOpenChange={setShowSourceManage}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>管理源目录</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <p className="text-xs text-muted-foreground">
              管理 Skills 源目录列表，项目绑定时可选择不同的源目录。
            </p>
            {sourceDirs.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center">
                <p className="text-sm text-muted-foreground">暂无源目录，请添加</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {sourceDirs.map(sd => (
                  <div
                    key={sd.id}
                    className={`flex items-center gap-2 rounded-md border p-2.5 ${
                      sd.id === activeSourceDirId ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{sd.name}</span>
                        {sd.id === activeSourceDirId && (
                          <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">当前</span>
                        )}
                      </div>
                      <code className="text-[10px] text-muted-foreground truncate block">{sd.path}</code>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      title="编辑"
                      onClick={() => {
                        setEditingSource(sd)
                        setNewSourceName(sd.name)
                        setNewSourcePath(sd.path)
                        setSourceError('')
                        setShowEditSource(true)
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                      title="删除"
                      onClick={() => handleDeleteSource(sd.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNewSourceName('')
                setNewSourcePath('')
                setSourceError('')
                setShowAddSource(true)
              }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              添加源目录
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Source Dir Dialog */}
      <Dialog open={showAddSource} onOpenChange={setShowAddSource}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>添加源目录</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sourceName">名称</Label>
              <Input
                id="sourceName"
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
                placeholder="例如：前端规范"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sourcePath">路径</Label>
              <Input
                id="sourcePath"
                value={newSourcePath}
                onChange={(e) => setNewSourcePath(e.target.value)}
                placeholder="/path/to/skills-source"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddSource()
                }}
              />
            </div>
            {sourceError && (
              <p className="text-sm text-destructive">{sourceError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSource(false)}>
              取消
            </Button>
            <Button onClick={handleAddSource}>添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Source Dir Dialog */}
      <Dialog open={showEditSource} onOpenChange={setShowEditSource}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑源目录</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editSourceName">名称</Label>
              <Input
                id="editSourceName"
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
                placeholder="例如：前端规范"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editSourcePath">路径</Label>
              <Input
                id="editSourcePath"
                value={newSourcePath}
                onChange={(e) => setNewSourcePath(e.target.value)}
                placeholder="/path/to/skills-source"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleEditSource()
                }}
              />
            </div>
            {sourceError && (
              <p className="text-sm text-destructive">{sourceError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditSource(false)}>
              取消
            </Button>
            <Button onClick={handleEditSource}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Skill Generator */}
      <AISkillGenerator
        open={showAIGenerate}
        onOpenChange={setShowAIGenerate}
        sourceDir={sourceDir}
        onSuccess={refreshTree}
      />

      <AISkillOptimizer
        open={showAIOptimize}
        onOpenChange={setShowAIOptimize}
        dirPath={optimizeDirPath}
        onSuccess={() => {
          refreshTree()
          // Re-select current file to refresh editor content
          if (selectedFile) {
            selectFile(selectedFile)
          }
        }}
      />

      {/* Skill Alias Dialog */}
      <Dialog open={showAliasDialog} onOpenChange={setShowAliasDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{skillAliases[aliasDirPath] ? '修改别名' : '设置别名'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-xs text-muted-foreground">
              文件夹：<span className="font-mono">{aliasDirPath.split('/').pop()}</span>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alias-input" className="text-sm">自定义展示名称</Label>
              <Input
                id="alias-input"
                value={aliasValue}
                onChange={(e) => setAliasValue(e.target.value)}
                placeholder="输入自定义别名..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleConfirmAlias()
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAliasDialog(false)}>取消</Button>
            <Button onClick={handleConfirmAlias} disabled={!aliasValue.trim()}>确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <VersionHistoryDialog
        open={showVersionHistory}
        onOpenChange={setShowVersionHistory}
        skillPath={versionSkillPath}
        skillName={versionSkillName}
        onRestored={() => {
          refreshTree()
          if (selectedFile) {
            selectFile(selectedFile)
          }
        }}
      />
    </div>
  )
}
