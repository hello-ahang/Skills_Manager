import { useState } from 'react'
import { toolsApi } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface ValidatorProps {
  onBack: () => void
}

interface ValidationResult {
  path: string
  valid: boolean
  errors: { line: number; message: string }[]
  warnings: { line: number; message: string }[]
}

export default function Validator({ onBack }: ValidatorProps) {
  const [paths, setPaths] = useState('')
  const [results, setResults] = useState<ValidationResult[]>([])
  const [loading, setLoading] = useState(false)
  const [hasValidated, setHasValidated] = useState(false)

  const handleValidate = async () => {
    const pathList = paths.split('\n').map((p) => p.trim()).filter(Boolean)
    if (pathList.length === 0) {
      toast.warning('请输入至少一个文件路径')
      return
    }

    setLoading(true)
    try {
      const data = await toolsApi.validate(pathList)
      setResults(data.results)
      setHasValidated(true)
      const validCount = data.results.filter((r: ValidationResult) => r.valid).length
      toast.success(`校验完成: ${validCount}/${data.results.length} 通过`)
    } catch (error) {
      toast.error('校验失败')
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
        <h2 className="text-lg font-semibold">语法校验</h2>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <Label>文件路径（每行一个）</Label>
            <textarea
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={paths}
              onChange={(e) => setPaths(e.target.value)}
              placeholder="/path/to/skill1.md&#10;/path/to/skill2.md"
            />
          </div>
          <Button onClick={handleValidate} disabled={loading} className="w-full">
            {loading ? '校验中...' : '开始校验'}
          </Button>
        </CardContent>
      </Card>

      {hasValidated && results.length > 0 && (
        <div className="space-y-3">
          {results.map((result, i) => {
            const fileName = result.path.split('/').pop() || result.path
            return (
              <Card key={i}>
                <CardHeader className="pb-2 p-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      {result.valid ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="font-mono">{fileName}</span>
                    </CardTitle>
                    <div className="flex gap-2">
                      {result.errors.length > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {result.errors.length} 错误
                        </Badge>
                      )}
                      {result.warnings.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {result.warnings.length} 警告
                        </Badge>
                      )}
                      {result.valid && result.warnings.length === 0 && (
                        <Badge className="text-xs bg-green-500">通过</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {(result.errors.length > 0 || result.warnings.length > 0) && (
                  <CardContent className="p-4 pt-0 space-y-1">
                    {result.errors.map((err, ei) => (
                      <div key={`e${ei}`} className="flex items-start gap-2 text-xs">
                        <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground w-8">L{err.line}</span>
                        <span>{err.message}</span>
                      </div>
                    ))}
                    {result.warnings.map((warn, wi) => (
                      <div key={`w${wi}`} className="flex items-start gap-2 text-xs">
                        <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground w-8">L{warn.line}</span>
                        <span>{warn.message}</span>
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
