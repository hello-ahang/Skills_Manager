import { useState } from 'react'
import { toolsApi } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface DiffViewerProps {
  onBack: () => void
}

interface DiffLine {
  type: 'add' | 'remove' | 'normal'
  content: string
}

interface DiffHunk {
  oldStart: number
  newStart: number
  lines: DiffLine[]
}

export default function DiffViewer({ onBack }: DiffViewerProps) {
  const [file1, setFile1] = useState('')
  const [file2, setFile2] = useState('')
  const [hunks, setHunks] = useState<DiffHunk[]>([])
  const [loading, setLoading] = useState(false)
  const [hasCompared, setHasCompared] = useState(false)

  const handleCompare = async () => {
    if (!file1.trim() || !file2.trim()) {
      toast.warning('请输入两个文件路径')
      return
    }

    setLoading(true)
    try {
      const data = await toolsApi.diff(file1.trim(), file2.trim())
      setHunks(data.hunks)
      setHasCompared(true)
      if (data.hunks.length === 0) {
        toast.info('两个文件内容完全相同')
      }
    } catch (error) {
      toast.error('对比失败，请检查文件路径')
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
        <h2 className="text-lg font-semibold">差异对比</h2>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>文件 1</Label>
              <Input
                value={file1}
                onChange={(e) => setFile1(e.target.value)}
                placeholder="/path/to/file1.md"
              />
            </div>
            <div className="space-y-2">
              <Label>文件 2</Label>
              <Input
                value={file2}
                onChange={(e) => setFile2(e.target.value)}
                placeholder="/path/to/file2.md"
              />
            </div>
          </div>
          <Button onClick={handleCompare} disabled={loading} className="w-full">
            {loading ? '对比中...' : '开始对比'}
          </Button>
        </CardContent>
      </Card>

      {hasCompared && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              对比结果 {hunks.length === 0 ? '(无差异)' : `(${hunks.length} 处差异)`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {hunks.length > 0 && (
              <div className="overflow-x-auto">
                {hunks.map((hunk, hi) => (
                  <div key={hi} className="border-t first:border-t-0">
                    <div className="bg-muted/50 px-4 py-1 text-xs text-muted-foreground font-mono">
                      @@ -{hunk.oldStart} +{hunk.newStart} @@
                    </div>
                    {hunk.lines.map((line, li) => (
                      <div
                        key={li}
                        className={cn(
                          'px-4 py-0.5 font-mono text-xs',
                          line.type === 'add' && 'bg-green-500/10 text-green-700 dark:text-green-400',
                          line.type === 'remove' && 'bg-red-500/10 text-red-700 dark:text-red-400',
                        )}
                      >
                        <span className="inline-block w-4 select-none text-muted-foreground">
                          {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                        </span>
                        {line.content}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
