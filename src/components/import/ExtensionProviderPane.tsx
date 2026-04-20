import { useState } from 'react'
import { useImportStore } from '@/stores/importStore'
import { importApi } from '@/api/client'
import { toast } from 'sonner'
import {
  Puzzle, Search, Loader2, ExternalLink, FolderDown,
  AlertCircle, FileCode, ArrowRight, RefreshCw, KeyRound,
} from 'lucide-react'
import type { ImportProviderInfo } from '@/types'

interface ExtensionProviderPaneProps {
  providerId: string
  providers: ImportProviderInfo[]
}

/**
 * ExtensionProviderPane — handles two states for extension providers:
 * 1. Registered: shows scan form (input + scan button)
 * 2. Not registered: shows setup guide
 */
export default function ExtensionProviderPane({ providerId, providers }: ExtensionProviderPaneProps) {
  const provider = providers.find(p => p.id === providerId)

  if (provider) {
    return <RegisteredProviderView provider={provider} />
  }

  return <UnregisteredProviderGuide providerId={providerId} />
}

/* ── Registered Provider: Scan Form ── */

function RegisteredProviderView({ provider }: { provider: ImportProviderInfo }) {
  const [input, setInput] = useState('')
  const [scanning, setScanning] = useState(false)
  const { setScannedSkills, setImportStep, setScanError, setImportSource, setSourceUrl, setRepoInfo } = useImportStore()

  // Auth fields state with localStorage persistence
  const storageKey = `ext-auth-${provider.id}`
  const [authValues, setAuthValues] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '{}')
    } catch { return {} }
  })

  const updateAuthValue = (key: string, value: string) => {
    const updated = { ...authValues, [key]: value }
    setAuthValues(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  const handleScan = async () => {
    if (!input.trim()) {
      toast.error('请输入 URL 或关键词')
      return
    }

    // Check if required auth fields are filled
    if (provider.requiresAuth && provider.authFields) {
      const missingFields = provider.authFields.filter(f => !authValues[f.key]?.trim())
      if (missingFields.length > 0) {
        toast.error(`请先填写认证信息：${missingFields.map(f => f.label).join('、')}`)
        return
      }
    }

    setScanning(true)
    setScanError(null)

    try {
      // Pass auth values as options when scanning
      const options = provider.authFields ? authValues : undefined
      const result = await importApi.scanByProvider(provider.id, input.trim(), options)
      if (result.skills && result.skills.length > 0) {
        setScannedSkills(result.skills)
        // Set import source to provider ID so history records correct source
        setImportSource(provider.id as any)
        setSourceUrl(input.trim())
        // Set repoInfo if returned (contains version info)
        if (result.repoInfo) {
          setRepoInfo(result.repoInfo)
        }
        setImportStep(2)
        toast.success(`发现 ${result.skills.length} 个 Skill`)
      } else {
        toast.warning('未发现可导入的 Skill')
      }
    } catch (error: any) {
      const message = error.message || '扫描失败'
      setScanError(message)
      toast.error(message)
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Puzzle className="h-5 w-5 text-primary" />
        <h3 className="text-base font-semibold">{provider.name}</h3>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
          扩展
        </span>
      </div>

      <p className="text-sm text-muted-foreground">
        此导入源由扩展提供。请在下方输入 URL 或关键词进行搜索。
      </p>

      {/* Auth fields — inline configuration */}
      {provider.authFields && provider.authFields.length > 0 && (
        <div className="space-y-2.5 rounded-md border bg-muted/20 p-3">
          <p className="text-xs font-medium flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5 text-amber-500" />
            认证配置
          </p>
          {provider.authFields.map(field => (
            <div key={field.key}>
              <label className="text-xs text-muted-foreground mb-1 block">{field.label}</label>
              <input
                type={field.type}
                value={authValues[field.key] || ''}
                onChange={(e) => updateAuthValue(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground">认证信息仅保存在本地浏览器中，不会上传到服务器</p>
        </div>
      )}

      {/* Scan form */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !scanning && handleScan()}
          placeholder="输入 URL 或关键词..."
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          onClick={handleScan}
          disabled={scanning || !input.trim()}
          className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {scanning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          扫描
        </button>
      </div>
    </div>
  )
}

/* ── Unregistered Provider: Setup Guide ── */

function UnregisteredProviderGuide({ providerId }: { providerId: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-5">
      {/* Icon */}
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
        <FolderDown className="h-8 w-8 text-muted-foreground" />
      </div>

      {/* Title */}
      <div className="text-center space-y-1.5">
        <h3 className="text-base font-semibold">此导入源尚未配置</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          需要在扩展目录中放置对应的扩展文件，才能启用此导入源。
        </p>
      </div>

      {/* Steps */}
      <div className="w-full max-w-md space-y-3">
        <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <FileCode className="h-4 w-4 text-primary" />
            配置步骤
          </h4>

          <div className="space-y-2.5">
            <StepItem
              number={1}
              title="创建扩展文件"
              description={
                <>
                  在 <code className="text-xs bg-muted px-1 py-0.5 rounded">~/.skills-manager/extensions/</code> 目录下创建一个 <code className="text-xs bg-muted px-1 py-0.5 rounded">.js</code> 文件
                </>
              }
            />
            <StepItem
              number={2}
              title="编写 Provider 注册逻辑"
              description={
                <>
                  导出 <code className="text-xs bg-muted px-1 py-0.5 rounded">setup(context)</code> 函数，调用 <code className="text-xs bg-muted px-1 py-0.5 rounded">context.registerImportProvider()</code> 注册导入源
                </>
              }
            />
            <StepItem
              number={3}
              title="重启 Skills Manager"
              description="扩展在启动时加载，修改后需要重启服务"
            />
          </div>
        </div>

        {/* Quick example */}
        <details className="rounded-lg border bg-muted/10 overflow-hidden">
          <summary className="px-4 py-2.5 text-sm font-medium cursor-pointer hover:bg-muted/20 transition-colors flex items-center gap-2">
            <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
            查看示例代码
          </summary>
          <div className="px-4 pb-3">
            <pre className="text-xs bg-muted/30 rounded-md p-3 overflow-x-auto leading-relaxed">
{`// ~/.skills-manager/extensions/my-provider.js
export function setup(context) {
  context.registerImportProvider({
    id: '${providerId}',
    name: 'My Import Source',
    icon: 'Package',
    group: 'custom',
    async scan(input, options) {
      // 调用你的 API 搜索 Skills
      const res = await fetch(\`https://api.example.com/skills?q=\${input}\`);
      const data = await res.json();
      return {
        skills: data.items.map(item => ({
          name: item.name,
          path: item.url,
          description: item.desc,
          fileCount: 1,
          totalSize: 0,
          isValid: true,
          files: [],
          selected: true,
        })),
      };
    },
  });
}`}
            </pre>
          </div>
        </details>

        {/* Doc links */}
        <div className="flex gap-2">
          <a
            href="https://github.com/hello-ahang/Skills_Manager/blob/main/docs/provider-guide.md"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            用户指南
          </a>
          <a
            href="https://github.com/hello-ahang/Skills_Manager/blob/main/docs/extensions.md"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            API 参考
          </a>
        </div>
      </div>
    </div>
  )
}

/* ── Step Item ── */

function StepItem({ number, title, description }: {
  number: number
  title: string
  description: React.ReactNode
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary mt-0.5">
        {number}
      </div>
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  )
}
