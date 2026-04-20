import { useState, useEffect, useRef } from 'react'
import { useImportStore } from '@/stores/importStore'
import { useConfigStore } from '@/stores/configStore'
import { importApi, configApi } from '@/api/client'
import { toast } from 'sonner'
import { Settings, Loader2, Save, Puzzle, KeyRound, Upload, Trash2, FileCode } from 'lucide-react'
import type { ImportProviderInfo } from '@/types'

/* ── Extension Plugin Manager sub-component ── */
function ExtensionPluginManager() {
  const [extensions, setExtensions] = useState<{ name: string; path: string }[]>([])
  const [extDir, setExtDir] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchExtensions = () => {
    setLoading(true)
    importApi.getExtensions()
      .then(({ extensions: exts, directory }) => {
        setExtensions(exts)
        setExtDir(directory)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchExtensions() }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so same file can be re-selected
    e.target.value = ''

    setUploading(true)
    try {
      const result = await importApi.uploadExtension(file)
      toast.success(result.message)
      fetchExtensions()
    } catch (err: any) {
      toast.error(err.message || '上传失败')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (name: string) => {
    if (!confirm(`确定删除扩展插件 ${name}？重启后生效。`)) return
    try {
      const result = await importApi.deleteExtension(name)
      toast.success(result.message)
      fetchExtensions()
    } catch {
      toast.error('删除失败')
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium flex items-center gap-1.5">
          <FileCode className="h-3.5 w-3.5 text-blue-500" />
          扩展插件
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1 rounded-md border border-dashed border-muted-foreground/30 px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          导入插件
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".js,.mjs"
          onChange={handleUpload}
          className="hidden"
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
          <Loader2 className="h-3 w-3 animate-spin" /> 加载中...
        </div>
      ) : extensions.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          暂无扩展插件。点击"导入插件"选择本地 .js 文件安装。
        </p>
      ) : (
        <div className="space-y-1">
          {extensions.map(ext => (
            <div key={ext.name} className="flex items-center justify-between rounded-md border bg-muted/10 px-2.5 py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <FileCode className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-mono truncate">{ext.name}</span>
              </div>
              <button
                onClick={() => handleDelete(ext.name)}
                className="p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-red-500 shrink-0"
                title="删除"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        插件安装到 <code className="bg-muted px-1 py-0.5 rounded">{extDir || '~/.skills-manager/extensions/'}</code>，重启后生效
      </p>
    </div>
  )
}

/* ── Extension Auth Config sub-component ── */
function ExtensionAuthConfig() {
  const [providers, setProviders] = useState<ImportProviderInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    importApi.getProviders()
      .then(({ providers: all }) => {
        const authProviders = all.filter(
          (p: ImportProviderInfo) => p.group === 'custom' && p.requiresAuth && p.authFields && p.authFields.length > 0
        )
        setProviders(authProviders)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <Loader2 className="h-3 w-3 animate-spin" /> 检测扩展...
      </div>
    )
  }

  if (providers.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">
        暂无需要认证的扩展
      </p>
    )
  }

  return (
    <div className="space-y-3 mt-2">
      <p className="text-xs font-medium flex items-center gap-1.5">
        <KeyRound className="h-3.5 w-3.5 text-amber-500" />
        扩展认证配置
      </p>
      {providers.map(provider => (
        <ExtensionAuthFields key={provider.id} provider={provider} />
      ))}
    </div>
  )
}

function ExtensionAuthFields({ provider }: { provider: ImportProviderInfo }) {
  const storageKey = `ext-auth-${provider.id}`
  const [values, setValues] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '{}')
    } catch { return {} }
  })
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)

  const updateValue = (key: string, value: string) => {
    const updated = { ...values, [key]: value }
    setValues(updated)
    setDirty(true)
    setSaved(false)
  }

  const handleSave = () => {
    localStorage.setItem(storageKey, JSON.stringify(values))
    setDirty(false)
    setSaved(true)
    toast.success(`${provider.name} 认证配置已保存`)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!provider.authFields || provider.authFields.length === 0) return null

  return (
    <div className="rounded-md border bg-muted/10 p-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <Puzzle className="h-3 w-3 text-primary" />
        <span className="text-xs font-medium">{provider.name}</span>
      </div>
      {provider.authFields.map(field => (
        <div key={field.key}>
          <label className="text-[11px] text-muted-foreground mb-0.5 block">{field.label}</label>
          <input
            type={field.type}
            value={values[field.key] || ''}
            onChange={(e) => updateValue(field.key, e.target.value)}
            placeholder={field.placeholder}
            className="w-full rounded-md border bg-background px-2 py-1 text-xs"
          />
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <p className="text-[10px] text-muted-foreground">认证信息仅保存在本地浏览器中</p>
        <button
          onClick={handleSave}
          disabled={!dirty}
          className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Save className="h-3 w-3" />
          {saved ? '已保存' : '保存'}
        </button>
      </div>
    </div>
  )
}

export default function ImportSettings() {
  const { importSettings, setImportSettings } = useImportStore()
  const sourceDirs = useConfigStore(s => s.sourceDirs)
  const preferences = useConfigStore(s => s.preferences)
  const updateConfig = useConfigStore(s => s.updateConfig)

  // Git tokens state (loaded from backend, saved to user local config)
  const [gitTokens, setGitTokens] = useState({ github: '', gitee: '', gitlab: '' })
  const [tokensLoading, setTokensLoading] = useState(true)
  const [tokensSaving, setTokensSaving] = useState(false)

  useEffect(() => {
    importApi.getGitTokens()
      .then((data) => setGitTokens({ github: data.github || '', gitee: data.gitee || '', gitlab: data.gitlab || '' }))
      .catch(() => {})
      .finally(() => setTokensLoading(false))
  }, [])

  const handleSaveTokens = async () => {
    setTokensSaving(true)
    try {
      await importApi.saveGitTokens(gitTokens)
      toast.success('Token 已保存到本地')
    } catch {
      toast.error('保存失败')
    } finally {
      setTokensSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Settings className="h-4 w-4" />
        导入设置
      </h3>

      <div className="space-y-4 rounded-lg border p-4">
        {/* Default source directory */}
        {sourceDirs.length > 0 && (
          <div>
            <label className="text-sm font-medium mb-1 block">默认导入源目录</label>
            <select
              value={importSettings.defaultSourceDirId}
              onChange={(e) => setImportSettings({ defaultSourceDirId: e.target.value })}
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            >
              <option value="">跟随当前活跃目录</option>
              {sourceDirs.map((dir) => (
                <option key={dir.id} value={dir.id}>{dir.name} ({dir.path})</option>
              ))}
            </select>
          </div>
        )}

        {/* Default conflict strategy */}
        <div>
          <label className="text-sm font-medium mb-1 block">默认冲突处理方式</label>
          <select
            value={importSettings.defaultConflictStrategy}
            onChange={(e) => setImportSettings({ defaultConflictStrategy: e.target.value as any })}
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          >
            <option value="skip">跳过</option>
            <option value="overwrite">覆盖（自动备份）</option>
            <option value="rename">重命名</option>
            <option value="merge">合并</option>
          </select>
        </div>

        {/* Default import mode */}
        <div>
          <label className="text-sm font-medium mb-1 block">默认导入模式（本地导入）</label>
          <select
            value={importSettings.defaultImportMode}
            onChange={(e) => setImportSettings({ defaultImportMode: e.target.value as any })}
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          >
            <option value="copy">复制</option>
            <option value="move">移动</option>
          </select>
        </div>

        {/* Git platform tokens — stored in user local config */}
        <div className="pt-2 border-t space-y-3">
          <label className="text-sm font-medium block">Git 平台 Token（可选）</label>
          {tokensLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="h-3 w-3 animate-spin" /> 加载中...
            </div>
          ) : (
            <>
              {[
                { key: 'github' as const, label: 'GitHub Token', placeholder: 'ghp_xxxxxxxxxxxx' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
                  <input
                    type="password"
                    value={gitTokens[key]}
                    onChange={(e) => setGitTokens(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                  />
                </div>
              ))}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  配置 Token 可访问私有仓库（公开仓库无需 Token）
                </p>
                <button
                  onClick={handleSaveTokens}
                  disabled={tokensSaving}
                  className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {tokensSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  保存
                </button>
              </div>
            </>
          )}
        </div>

        {/* Toggle switches */}
        <div className="space-y-3 pt-2 border-t">
          {[
            { key: 'autoSnapshotOnImport', label: '导入时自动创建版本快照' },
            { key: 'clipboardDetection', label: '打开导入中心时检测剪贴板' },
            { key: 'autoCleanTempFiles', label: '自动清理临时文件' },
            { key: 'autoSyncAfterImport', label: '导入后自动同步到所有已绑定项目' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between">
              <span className="text-sm">{label}</span>
              <input
                type="checkbox"
                checked={(importSettings as any)[key]}
                onChange={(e) => setImportSettings({ [key]: e.target.checked })}
                className="rounded"
              />
            </label>
          ))}
        </div>

        {/* Extension Provider mode */}
        <div className="pt-2 border-t space-y-2">
          <label className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Puzzle className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-sm font-medium">Provider 注册模式</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  开启后，导入中心将显示通过扩展注册的自定义导入源
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences?.enableExtensionProviders ?? false}
              onChange={(e) => {
                updateConfig({ preferences: { enableExtensionProviders: e.target.checked } })
                if (e.target.checked) {
                  toast.success('Provider 注册模式已开启')
                } else {
                  toast.info('Provider 注册模式已关闭')
                }
              }}
              className="rounded"
            />
          </label>
          {preferences?.enableExtensionProviders && (
            <div className="pl-6 space-y-3">
              <ExtensionPluginManager />
              <ExtensionAuthConfig />
            </div>
          )}
        </div>

        {/* Auto-update interval */}
        <div className="pt-2 border-t">
          <label className="text-sm font-medium mb-1 block">自动更新频率</label>
          <select
            value={importSettings.autoUpdateInterval}
            onChange={(e) => setImportSettings({ autoUpdateInterval: e.target.value as any })}
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          >
            <option value="disabled">关闭</option>
            <option value="daily">每天</option>
            <option value="weekly">每周</option>
            <option value="monthly">每月</option>
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            自动检查已订阅 Skill 的更新
          </p>
        </div>
      </div>
    </div>
  )
}