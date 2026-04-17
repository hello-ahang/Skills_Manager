import { useRef, useCallback, useMemo } from 'react'
import MonacoEditor, { OnMount, DiffEditor } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { useConfigStore } from '@/stores/configStore'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Save, Pencil, X, Eye, FileCode, GitCompare } from 'lucide-react'
import type { EditorMode } from '@/stores/skillsStore'

interface EditorProps {
  content: string
  originalContent: string
  filePath: string | null
  saving: boolean
  unsavedChanges: boolean
  editorMode: EditorMode
  onChange: (content: string) => void
  onSave: () => void
  onEnterEdit: () => void
  onCancelEdit: () => void
  onSetMode: (mode: EditorMode) => void
}

export default function SkillEditor({
  content,
  originalContent,
  filePath,
  saving,
  unsavedChanges,
  editorMode,
  onChange,
  onSave,
  onEnterEdit,
  onCancelEdit,
  onSetMode,
}: EditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const { preferences } = useConfigStore()

  const isDark = preferences.theme === 'dark' ||
    (preferences.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave()
    })
  }

  const handleChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      onChange(value)
    }
  }, [onChange])

  const isMarkdownFile = useMemo(() => {
    if (!filePath) return false
    return /\.(md|mdx|markdown)$/i.test(filePath)
  }, [filePath])

  if (!filePath) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg">选择一个文件开始编辑</p>
          <p className="mt-1 text-sm">从左侧文件树中选择文件</p>
        </div>
      </div>
    )
  }

  const fileName = filePath.split('/').pop() || ''
  const isEditing = editorMode === 'edit'

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{fileName}</span>
          {unsavedChanges && (
            <span className="h-2 w-2 rounded-full bg-orange-500" title="未保存的更改" />
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Mode toggle buttons */}
          {!isEditing && (
            <>
              <Button
                variant={editorMode === 'preview' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => onSetMode('preview')}
                title="源码预览"
              >
                <FileCode className="mr-1.5 h-3.5 w-3.5" />
                源码
              </Button>
              {isMarkdownFile && (
                <Button
                  variant={editorMode === 'markdown-preview' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => onSetMode('markdown-preview')}
                  title="Markdown 渲染预览"
                >
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                  预览
                </Button>
              )}
            </>
          )}

          {isEditing && (
            <>
              <Button
                variant={editorMode === 'edit' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => onSetMode('edit')}
                title="编辑模式"
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                编辑
              </Button>
              {unsavedChanges && (
                <Button
                  variant={editorMode === 'diff' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => onSetMode('diff')}
                  title="查看修改差异"
                >
                  <GitCompare className="mr-1.5 h-3.5 w-3.5" />
                  Diff
                </Button>
              )}
            </>
          )}

          <div className="mx-1 h-4 w-px bg-border" />

          {/* Action buttons */}
          {!isEditing && editorMode !== 'diff' ? (
            <Button size="sm" onClick={onEnterEdit}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              编辑
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                onClick={onSave}
                disabled={saving || !unsavedChanges}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {saving ? '保存中...' : '保存'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancelEdit}
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                取消
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {editorMode === 'preview' && (
          <MonacoEditor
            height="100%"
            language="markdown"
            theme={isDark ? 'vs-dark' : 'vs'}
            value={content}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 14,
              wordWrap: 'on',
              automaticLayout: true,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              renderWhitespace: 'selection',
              tabSize: 2,
              padding: { top: 8 },
              domReadOnly: true,
              cursorStyle: 'line',
            }}
          />
        )}

        {editorMode === 'edit' && (
          <MonacoEditor
            height="100%"
            language="markdown"
            theme={isDark ? 'vs-dark' : 'vs'}
            value={content}
            onChange={handleChange}
            onMount={handleEditorDidMount}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              wordWrap: 'on',
              automaticLayout: true,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              renderWhitespace: 'selection',
              tabSize: 2,
              padding: { top: 8 },
            }}
          />
        )}

        {editorMode === 'diff' && (
          <DiffEditor
            height="100%"
            language="markdown"
            theme={isDark ? 'vs-dark' : 'vs'}
            original={originalContent}
            modified={content}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 14,
              wordWrap: 'on',
              automaticLayout: true,
              scrollBeyondLastLine: false,
              renderSideBySide: true,
              padding: { top: 8 },
            }}
          />
        )}

        {editorMode === 'markdown-preview' && (
          <ScrollArea className="h-full">
            <div className="prose prose-sm dark:prose-invert max-w-none p-6">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                {content}
              </ReactMarkdown>
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
