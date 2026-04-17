import { useState } from 'react'
import { toolsApi } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

const toolOptions = [
  { value: 'claude', label: 'Claude' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'codebuddy', label: 'CodeBuddy' },
  { value: 'copilot', label: 'GitHub Copilot' },
]

interface FormatConverterProps {
  onBack: () => void
}

export default function FormatConverter({ onBack }: FormatConverterProps) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [files, setFiles] = useState('')
  const [outputDir, setOutputDir] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])

  const handleConvert = async () => {
    if (!from || !to || !files.trim() || !outputDir.trim()) {
      toast.warning('请填写所有字段')
      return
    }

    const fileList = files.split('\n').map((f) => f.trim()).filter(Boolean)
    if (fileList.length === 0) {
      toast.warning('请输入至少一个文件路径')
      return
    }

    setLoading(true)
    try {
      const data = await toolsApi.convert({
        files: fileList,
        from,
        to,
        outputDir: outputDir.trim(),
      })
      setResults(data.results)
      const successCount = data.results.filter((r: any) => r.success).length
      toast.success(`转换完成: ${successCount}/${data.results.length} 成功`)
    } catch (error) {
      toast.error('转换失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          返回
        </Button>
        <h2 className="text-lg font-semibold">格式转换</h2>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <Label>从</Label>
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger>
                  <SelectValue placeholder="选择源格式" />
                </SelectTrigger>
                <SelectContent>
                  {toolOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ArrowRight className="mt-6 h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1 space-y-2">
              <Label>到</Label>
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger>
                  <SelectValue placeholder="选择目标格式" />
                </SelectTrigger>
                <SelectContent>
                  {toolOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>文件路径（每行一个）</Label>
            <textarea
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={files}
              onChange={(e) => setFiles(e.target.value)}
              placeholder="/path/to/file1.md&#10;/path/to/file2.md"
            />
          </div>

          <div className="space-y-2">
            <Label>输出目录</Label>
            <Input
              value={outputDir}
              onChange={(e) => setOutputDir(e.target.value)}
              placeholder="/path/to/output/"
            />
          </div>

          <Button onClick={handleConvert} disabled={loading} className="w-full">
            {loading ? '转换中...' : '执行转换'}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">转换结果</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-1">
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className={r.success ? 'text-green-500' : 'text-red-500'}>
                    {r.success ? '✅' : '❌'}
                  </span>
                  <span className="truncate font-mono text-xs">{r.source}</span>
                  {r.error && (
                    <span className="text-xs text-destructive ml-auto">{r.error}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
