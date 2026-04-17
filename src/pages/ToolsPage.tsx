import { useState } from 'react'
import { toolsApi } from '@/api/client'
import { useSkillsStore } from '@/stores/skillsStore'
import { toast } from 'sonner'
import ToolboxGrid from '@/components/tools/ToolboxGrid'
import FormatConverter from '@/components/tools/FormatConverter'
import DiffViewer from '@/components/tools/DiffViewer'
import Validator from '@/components/tools/Validator'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, FileArchive, Upload, Download } from 'lucide-react'
import { Label } from '@/components/ui/label'

type ActiveTool = null | 'convert' | 'validate' | 'diff' | 'export'

export default function ToolsPage() {
  const [activeTool, setActiveTool] = useState<ActiveTool>(null)
  const { sourceDir } = useSkillsStore()
  const [exportPaths, setExportPaths] = useState('')
  const [exporting, setExporting] = useState(false)

  const handleSelectTool = (toolId: string) => {
    setActiveTool(toolId as ActiveTool)
  }

  const handleBack = () => {
    setActiveTool(null)
  }

  const handleExport = async () => {
    const pathList = exportPaths.split('\n').map((p) => p.trim()).filter(Boolean)
    if (pathList.length === 0) {
      toast.warning('请输入至少一个路径')
      return
    }

    setExporting(true)
    try {
      await toolsApi.exportFiles(pathList)
      toast.success('导出成功')
    } catch (error) {
      toast.error('导出失败')
    } finally {
      setExporting(false)
    }
  }

  if (activeTool === 'convert') {
    return <FormatConverter onBack={handleBack} />
  }

  if (activeTool === 'validate') {
    return <Validator onBack={handleBack} />
  }

  if (activeTool === 'diff') {
    return <DiffViewer onBack={handleBack} />
  }

  if (activeTool === 'export') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            返回
          </Button>
          <h2 className="text-lg font-semibold">导入导出</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Download className="h-4 w-4" />
              导出为 ZIP
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>要导出的路径（每行一个文件或目录）</Label>
              <textarea
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={exportPaths}
                onChange={(e) => setExportPaths(e.target.value)}
                placeholder={sourceDir || '/path/to/skills-source'}
              />
            </div>
            <Button onClick={handleExport} disabled={exporting}>
              <FileArchive className="mr-1.5 h-4 w-4" />
              {exporting ? '导出中...' : '导出 ZIP'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <ToolboxGrid onSelectTool={handleSelectTool} />
    </div>
  )
}
