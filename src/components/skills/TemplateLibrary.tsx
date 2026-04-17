import { useState } from 'react'
import { SkillTemplate } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface TemplateLibraryProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  templates: SkillTemplate[]
  sourceDir: string
  onCreateFromTemplate: (path: string, templateId: string, variables: Record<string, string>) => Promise<void>
}

const categoryLabels: Record<string, string> = {
  'code-style': '代码规范',
  'testing': '测试策略',
  'documentation': '文档规范',
  'architecture': '架构设计',
  'custom': '自定义',
}

export default function TemplateLibrary({
  open,
  onOpenChange,
  templates,
  sourceDir,
  onCreateFromTemplate,
}: TemplateLibraryProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<SkillTemplate | null>(null)
  const [fileName, setFileName] = useState('')
  const [variables, setVariables] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSelectTemplate = (template: SkillTemplate) => {
    setSelectedTemplate(template)
    setFileName(`${template.id}.md`)
    const defaultVars: Record<string, string> = {}
    template.variables.forEach((v) => {
      defaultVars[v.key] = v.defaultValue
    })
    setVariables(defaultVars)
    setError('')
  }

  const handleCreate = async () => {
    if (!selectedTemplate || !fileName.trim()) {
      setError('请输入文件名')
      return
    }

    setLoading(true)
    setError('')

    try {
      const filePath = `${sourceDir}/${fileName.trim()}`
      await onCreateFromTemplate(filePath, selectedTemplate.id, variables)
      setSelectedTemplate(null)
      setFileName('')
      setVariables({})
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    setSelectedTemplate(null)
    setFileName('')
    setVariables({})
    setError('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {selectedTemplate ? `从模板创建: ${selectedTemplate.name}` : '模板库'}
          </DialogTitle>
          <DialogDescription>
            {selectedTemplate
              ? '配置模板变量并创建文件'
              : '选择一个内置模板来快速创建 Skill 文件'}
          </DialogDescription>
        </DialogHeader>

        {!selectedTemplate ? (
          <div className="grid grid-cols-2 gap-3 py-4">
            {templates.map((template) => (
              <Card
                key={template.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => handleSelectTemplate(template)}
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-sm">{template.name}</CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {categoryLabels[template.category] || template.category}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <CardDescription className="text-xs">
                    {template.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="filename">文件名</Label>
              <Input
                id="filename"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="skill-name.md"
              />
            </div>

            {selectedTemplate.variables.map((variable) => (
              <div key={variable.key} className="space-y-2">
                <Label htmlFor={variable.key}>{variable.label}</Label>
                <textarea
                  id={variable.key}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={variables[variable.key] || ''}
                  onChange={(e) =>
                    setVariables({ ...variables, [variable.key]: e.target.value })
                  }
                  placeholder={variable.description}
                />
                <p className="text-xs text-muted-foreground">{variable.description}</p>
              </div>
            ))}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          {selectedTemplate ? (
            <>
              <Button variant="outline" onClick={handleBack}>
                返回
              </Button>
              <Button onClick={handleCreate} disabled={loading}>
                {loading ? '创建中...' : '创建文件'}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              关闭
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
