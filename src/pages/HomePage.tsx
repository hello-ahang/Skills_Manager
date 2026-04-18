import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle,
  BarChart3,
  Download,
  GitBranch,
  Lightbulb,
  Palette,
  Pencil,
  Rocket,
  Sparkles,
  Wand2,
  Search,
  ArrowRight,
} from 'lucide-react'

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-4xl space-y-3">
      {/* Hero */}
      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold">Skills Manager</h1>
        <p className="text-xs text-muted-foreground">多 AI 工具 Skills 统一管理平台</p>
      </div>

      {/* 痛点 / 解法 / 步骤 */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-3 pb-3 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">😣</span>
              <h3 className="font-semibold text-xs text-destructive">痛点</h3>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              多个 AI 编程工具各自维护 Skills，内容分散、难以同步，重复劳动多。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-3 pb-3 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-primary" />
              <h3 className="font-semibold text-xs text-primary">解法</h3>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              统一源目录管理 Skills，通过软链接一键同步到各项目，一处维护、多处生效。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-3 pb-3 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Rocket className="h-3.5 w-3.5 text-primary" />
              <h3 className="font-semibold text-xs text-primary">步骤</h3>
            </div>
            <div className="text-[11px] text-muted-foreground leading-relaxed space-y-0.5">
              <p>① Skills 库添加源目录 →</p>
              <p>② 添加项目 →</p>
              <p>③ 绑定源目录 →</p>
              <p>④ 绑定/解除后重启项目程序。</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 软链接架构示意图 */}
      <Card>
        <CardContent className="pt-3 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold">软链接管理 Skills 方案</span>
          </div>
          <div className="flex items-center justify-center gap-3 text-[11px]">
            {/* 源目录 */}
            <div className="border rounded-md p-2 bg-secondary text-center">
              <p className="font-semibold text-primary">📁 Skills 源目录</p>
              <p className="text-muted-foreground">统一维护，一处编辑</p>
            </div>

            {/* 箭头 */}
            <div className="flex flex-col items-center gap-0.5 text-muted-foreground">
              <span>软链接同步</span>
              <span className="text-base">→</span>
            </div>

            {/* 项目列表 - 横向排列 */}
            <div className="flex gap-2">
              <div className="border rounded-md px-2 py-1.5 bg-secondary text-center">
                <p className="font-semibold text-foreground">🖥 项目 A</p>
                <p className="text-muted-foreground">.cursor/rules/</p>
              </div>
              <div className="border rounded-md px-2 py-1.5 bg-secondary text-center">
                <p className="font-semibold text-foreground">🖥 项目 B</p>
                <p className="text-muted-foreground">.windsurf/rules/</p>
              </div>
              <div className="border rounded-md px-2 py-1.5 bg-secondary text-center">
                <p className="font-semibold text-foreground">🖥 项目 C</p>
                <p className="text-muted-foreground">.github/copilot/</p>
              </div>
            </div>
          </div>
          <p className="text-center text-[11px] text-muted-foreground mt-2">源目录修改后，所有已绑定项目自动同步生效，无需重复操作</p>
        </CardContent>
      </Card>

      {/* 更多亮点 + 注意事项 并排 */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold">更多亮点</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <div className="flex items-center gap-1.5">
                <Pencil className="h-3 w-3 text-primary shrink-0" />
                <p className="text-[11px] text-muted-foreground">在线编辑，实时预览</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Wand2 className="h-3 w-3 text-primary shrink-0" />
                <p className="text-[11px] text-muted-foreground">AI 智能生成 Skills</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Search className="h-3 w-3 text-primary shrink-0" />
                <p className="text-[11px] text-muted-foreground">AI 检查/优化 Skills</p>
              </div>
              <div className="flex items-center gap-1.5">
                <GitBranch className="h-3 w-3 text-primary shrink-0" />
                <p className="text-[11px] text-muted-foreground">版本管理，快照回滚</p>
              </div>
              <div className="flex items-center gap-1.5">
                <BarChart3 className="h-3 w-3 text-primary shrink-0" />
                <p className="text-[11px] text-muted-foreground">使用分析，数据洞察</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Download className="h-3 w-3 text-primary shrink-0" />
                <p className="text-[11px] text-muted-foreground">导入中心，多源导入 Skills</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Palette className="h-3 w-3 text-primary shrink-0" />
                <p className="text-[11px] text-muted-foreground">多主题支持，深色模式</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-muted/50">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-xs font-semibold text-primary">注意事项</span>
            </div>
            <ul className="text-[11px] text-muted-foreground space-y-1 ml-4 list-disc">
              <li>悟空 Skills 必须经过审核，本产品不支持悟空。</li>
              <li>项目绑定 Skills 库后，原有 Skills 文件会移动到备份文件夹中。</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center justify-center gap-3">
        <Button size="sm" onClick={() => navigate('/skills')} className="gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          进入 Skills 库
          <ArrowRight className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="outline" onClick={() => navigate('/projects')} className="gap-1.5">
          进入项目管理
          <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
