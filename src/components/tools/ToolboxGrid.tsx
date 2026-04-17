import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeftRight, CheckCircle, FileText, FileArchive, FileDiff, Trash2 } from 'lucide-react'

interface ToolItem {
  id: string
  name: string
  description: string
  icon: React.ReactNode
}

interface ToolboxGridProps {
  onSelectTool: (toolId: string) => void
}

const tools: ToolItem[] = [
  {
    id: 'convert',
    name: '格式转换',
    description: '不同工具格式互相转换',
    icon: <ArrowLeftRight className="h-6 w-6" />,
  },
  {
    id: 'validate',
    name: '语法校验',
    description: '检查语法错误和格式问题',
    icon: <CheckCircle className="h-6 w-6" />,
  },
  {
    id: 'diff',
    name: '差异对比',
    description: '可视化 Diff 文件对比',
    icon: <FileDiff className="h-6 w-6" />,
  },
  {
    id: 'export',
    name: '导入导出',
    description: 'ZIP 打包一键备份',
    icon: <FileArchive className="h-6 w-6" />,
  },
]

export default function ToolboxGrid({ onSelectTool }: ToolboxGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {tools.map((tool) => (
        <Card
          key={tool.id}
          className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
          onClick={() => onSelectTool(tool.id)}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                {tool.icon}
              </div>
              <CardTitle className="text-sm">{tool.name}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-xs">{tool.description}</CardDescription>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
