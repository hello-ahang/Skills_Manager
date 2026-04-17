import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useConfigStore } from '@/stores/configStore'
import { configApi } from '@/api/client'
import { Moon, Sun, Monitor, Gamepad2, Layout, Bot, Plus, Pencil, Trash2, Zap, Loader2, CheckCircle2, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { v4 as uuidv4 } from 'uuid'
import type { LLMModel } from '@/types'

const pageTitles: Record<string, string> = {
  '/projects': '项目管理',
  '/skills': 'Skills 库',
  '/tools': '工具箱',
}

export default function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const { preferences, llmModels, setTheme, setUIStyle, updateConfig } = useConfigStore()
  const title = pageTitles[location.pathname] || 'Skills Manager'
  const isPixel = preferences.uiStyle === 'pixel'

  const [showModelManage, setShowModelManage] = useState(false)
  const [showAddModel, setShowAddModel] = useState(false)
  const [showEditModel, setShowEditModel] = useState(false)
  const [editingModel, setEditingModel] = useState<LLMModel | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  // Form state
  const [formProvider, setFormProvider] = useState('')
  const [formBaseUrl, setFormBaseUrl] = useState('')
  const [formApiKey, setFormApiKey] = useState('')
  const [formModelName, setFormModelName] = useState('')
  const [formDisplayName, setFormDisplayName] = useState('')
  const [formError, setFormError] = useState('')

  const resetForm = () => {
    setFormProvider('')
    setFormBaseUrl('')
    setFormApiKey('')
    setFormModelName('')
    setFormDisplayName('')
    setFormError('')
  }

  const handleAddModel = async () => {
    if (!formProvider.trim() || !formBaseUrl.trim() || !formApiKey.trim() || !formModelName.trim() || !formDisplayName.trim()) {
      setFormError('所有字段均为必填')
      return
    }
    const newModel: LLMModel = {
      id: uuidv4(),
      provider: formProvider.trim(),
      baseUrl: formBaseUrl.trim(),
      apiKey: formApiKey.trim(),
      modelName: formModelName.trim(),
      displayName: formDisplayName.trim(),
      tested: false,
    }
    try {
      await updateConfig({ llmModels: [...llmModels, newModel] })
      toast.success('模型已添加')
      setShowAddModel(false)
      resetForm()
    } catch {
      setFormError('添加失败')
    }
  }

  const handleEditModel = async () => {
    if (!editingModel) return
    if (!formProvider.trim() || !formBaseUrl.trim() || !formApiKey.trim() || !formModelName.trim() || !formDisplayName.trim()) {
      setFormError('所有字段均为必填')
      return
    }
    const updated = llmModels.map(m =>
      m.id === editingModel.id
        ? {
            ...m,
            provider: formProvider.trim(),
            baseUrl: formBaseUrl.trim(),
            apiKey: formApiKey.trim(),
            modelName: formModelName.trim(),
            displayName: formDisplayName.trim(),
            tested: false, // Reset test status after edit
          }
        : m
    )
    try {
      await updateConfig({ llmModels: updated })
      toast.success('模型已更新')
      setShowEditModel(false)
      setEditingModel(null)
      resetForm()
    } catch {
      setFormError('更新失败')
    }
  }

  const handleDeleteModel = async (id: string) => {
    const updated = llmModels.filter(m => m.id !== id)
    try {
      await updateConfig({ llmModels: updated })
      toast.success('模型已删除')
    } catch {
      toast.error('删除失败')
    }
  }

  const handleTestModel = async (model: LLMModel) => {
    setTestingId(model.id)
    try {
      const result = await configApi.testModel({
        baseUrl: model.baseUrl,
        apiKey: model.apiKey,
        modelName: model.modelName,
      })
      if (result.success) {
        // Update model as tested
        const updated = llmModels.map(m =>
          m.id === model.id ? { ...m, tested: true, testedAt: new Date().toISOString() } : m
        )
        await updateConfig({ llmModels: updated })
        toast.success(`连接成功！模型回复: ${result.reply}`)
      } else {
        toast.error(`连接失败: ${result.error}`)
      }
    } catch (err) {
      toast.error(`测试失败: ${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setTestingId(null)
    }
  }

  const openEditDialog = (model: LLMModel) => {
    setEditingModel(model)
    setFormProvider(model.provider)
    setFormBaseUrl(model.baseUrl)
    setFormApiKey(model.apiKey)
    setFormModelName(model.modelName)
    setFormDisplayName(model.displayName)
    setFormError('')
    setShowModelManage(false)
    setShowEditModel(true)
  }

  const ModelFormFields = () => (
    <div className="space-y-3 py-4">
      <div className="space-y-1.5">
        <Label htmlFor="provider" className="text-xs">模型提供商</Label>
        <Input id="provider" value={formProvider} onChange={e => setFormProvider(e.target.value)} placeholder="例如：idealab、openai" className="h-8 text-sm" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="baseUrl" className="text-xs">API 地址</Label>
        <Input id="baseUrl" value={formBaseUrl} onChange={e => setFormBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" className="h-8 text-sm" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="apiKey" className="text-xs">API Key</Label>
        <Input id="apiKey" type="password" value={formApiKey} onChange={e => setFormApiKey(e.target.value)} placeholder="sk-..." className="h-8 text-sm" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="modelName" className="text-xs">模型名称</Label>
        <Input id="modelName" value={formModelName} onChange={e => setFormModelName(e.target.value)} placeholder="例如：qwen3.6-plus-preview" className="h-8 text-sm" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="displayName" className="text-xs">显示标识</Label>
        <Input id="displayName" value={formDisplayName} onChange={e => setFormDisplayName(e.target.value)} placeholder="例如：Qwen 3.6 Plus" className="h-8 text-sm" />
      </div>
      {formError && <p className="text-sm text-destructive">{formError}</p>}
    </div>
  )

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* UI Style Toggle */}
          <div className="flex items-center rounded-md border-2 border-purple-300 dark:border-purple-700 p-0.5 bg-purple-50 dark:bg-purple-950/30">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 px-2.5 text-xs rounded-sm',
                !isPixel
                  ? 'bg-purple-600 text-white hover:bg-purple-700 hover:text-white'
                  : 'text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/50'
              )}
              onClick={() => setUIStyle('default')}
            >
              <Layout className="mr-1 h-3.5 w-3.5" />
              默认
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 px-2.5 text-xs rounded-sm',
                isPixel
                  ? 'bg-purple-600 text-white hover:bg-purple-700 hover:text-white'
                  : 'text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/50'
              )}
              onClick={() => setUIStyle('pixel')}
            >
              <Gamepad2 className="mr-1 h-3.5 w-3.5" />
              像素
            </Button>
          </div>

          {/* Theme Toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer outline-none">
                {preferences.theme === 'dark' ? (
                  <Moon className="h-4 w-4" />
                ) : preferences.theme === 'light' ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Monitor className="h-4 w-4" />
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme('light')}>
                <Sun className="mr-2 h-4 w-4" />
                浅色
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                <Moon className="mr-2 h-4 w-4" />
                深色
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                <Monitor className="mr-2 h-4 w-4" />
                跟随系统
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Model Config Button */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setShowModelManage(true)}
          >
            <Bot className="h-3.5 w-3.5" />
            模型配置
            {llmModels.length > 0 && (
              <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">
                {llmModels.length}
              </Badge>
            )}
          </Button>

          {/* Help Center Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            title="帮助中心"
            onClick={() => navigate('/help')}
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Model Management Dialog */}
      <Dialog open={showModelManage} onOpenChange={setShowModelManage}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              模型配置
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <p className="text-xs text-muted-foreground">
              配置 LLM 模型用于 AI 生成技能，支持 OpenAI 兼容接口。
            </p>
            {llmModels.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center">
                <p className="text-sm text-muted-foreground">暂无模型配置，请添加</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {llmModels.map(model => (
                  <div key={model.id} className="flex items-center gap-2 rounded-md border p-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{model.displayName}</span>
                        {model.tested ? (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0 gap-0.5 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            已验证
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            未验证
                          </Badge>
                        )}
                      </div>
                      <code className="text-[10px] text-muted-foreground truncate block">
                        {model.provider} / {model.modelName}
                      </code>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      title="测试连接"
                      disabled={testingId === model.id}
                      onClick={() => handleTestModel(model)}
                    >
                      {testingId === model.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Zap className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      title="编辑"
                      onClick={() => openEditDialog(model)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                      title="删除"
                      onClick={() => handleDeleteModel(model.id)}
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
                resetForm()
                setShowModelManage(false)
                setShowAddModel(true)
              }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              添加模型
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Model Dialog */}
      <Dialog open={showAddModel} onOpenChange={(open) => { setShowAddModel(open); if (!open) setShowModelManage(true); }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>添加模型</DialogTitle>
          </DialogHeader>
          <ModelFormFields />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddModel(false); setShowModelManage(true); }}>取消</Button>
            <Button onClick={handleAddModel}>添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Model Dialog */}
      <Dialog open={showEditModel} onOpenChange={(open) => { setShowEditModel(open); if (!open) setShowModelManage(true); }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>编辑模型</DialogTitle>
          </DialogHeader>
          <ModelFormFields />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditModel(false); setShowModelManage(true); }}>取消</Button>
            <Button onClick={handleEditModel}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
