import { useState, useEffect, useCallback } from 'react'
import { projectsApi, skillsApi } from '@/api/client'
import { FileTreeNode } from '@/types'
import type { EditorMode } from '@/stores/skillsStore'
import FileTree from '@/components/skills/FileTree'
import SkillEditor from '@/components/skills/Editor'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface ProjectFileBrowserProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folderPath: string
  folderName: string
}

export default function ProjectFileBrowser({
  open,
  onOpenChange,
  folderPath,
  folderName,
}: ProjectFileBrowserProps) {
  const [tree, setTree] = useState<FileTreeNode[]>([])
  const [treeLoading, setTreeLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [fileLoading, setFileLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [unsavedChanges, setUnsavedChanges] = useState(false)
  const [editorMode, setEditorMode] = useState<EditorMode>('preview')

  // Load file tree when dialog opens
  useEffect(() => {
    if (open && folderPath) {
      setTreeLoading(true)
      setSelectedFile(null)
      setFileContent('')
      setOriginalContent('')
      setUnsavedChanges(false)
      setEditorMode('preview')

      projectsApi
        .browse(folderPath)
        .then((data) => {
          setTree(data.tree)
        })
        .catch(() => {
          toast.error('加载目录失败')
          setTree([])
        })
        .finally(() => setTreeLoading(false))
    }
  }, [open, folderPath])

  // Load file content when a file is selected
  const selectFile = useCallback(async (filePath: string) => {
    if (filePath === selectedFile) return

    // Warn about unsaved changes
    if (unsavedChanges) {
      const confirmed = window.confirm('当前文件有未保存的更改，确定要切换文件吗？')
      if (!confirmed) return
    }

    setSelectedFile(filePath)
    setFileLoading(true)
    setEditorMode('preview')
    setUnsavedChanges(false)

    try {
      const data = await skillsApi.getFile(filePath)
      setFileContent(data.content)
      setOriginalContent(data.content)
    } catch {
      toast.error('加载文件失败')
      setFileContent('')
      setOriginalContent('')
    } finally {
      setFileLoading(false)
    }
  }, [selectedFile, unsavedChanges])

  const handleContentChange = useCallback((content: string) => {
    setFileContent(content)
    setUnsavedChanges(content !== originalContent)
  }, [originalContent])

  const handleSave = useCallback(async () => {
    if (!selectedFile) return
    setSaving(true)
    try {
      await skillsApi.saveFile(selectedFile, fileContent)
      setOriginalContent(fileContent)
      setUnsavedChanges(false)
      toast.success('保存成功')
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }, [selectedFile, fileContent])

  const handleEnterEdit = useCallback(() => {
    setEditorMode('edit')
  }, [])

  const handleCancelEdit = useCallback(() => {
    setFileContent(originalContent)
    setUnsavedChanges(false)
    setEditorMode('preview')
  }, [originalContent])

  // Dummy delete handler (required by FileTree but not used here)
  const handleDeleteFile = useCallback(() => {}, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[80vw] !w-[80vw] h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <DialogTitle className="text-sm">{folderName}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Left Panel: File Tree */}
          <div className="w-80 border-r flex flex-col min-h-0">
            {treeLoading ? (
              <div className="flex items-center justify-center flex-1">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-2">
                <FileTree
                  nodes={tree}
                  selectedFile={selectedFile}
                  onSelectFile={selectFile}
                  onDeleteFile={handleDeleteFile}
                />
              </div>
            )}
          </div>

          {/* Right Panel: Editor */}
          <div className="flex-1 min-h-0">
            {fileLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
                onChange={handleContentChange}
                onSave={handleSave}
                onEnterEdit={handleEnterEdit}
                onCancelEdit={handleCancelEdit}
                onSetMode={setEditorMode}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
