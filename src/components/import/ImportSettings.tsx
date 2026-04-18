import { useState, useEffect } from 'react'
import { useImportStore } from '@/stores/importStore'
import { useConfigStore } from '@/stores/configStore'
import { importApi } from '@/api/client'
import { toast } from 'sonner'
import { Settings, Loader2, Save } from 'lucide-react'

export default function ImportSettings() {
  const { importSettings, setImportSettings } = useImportStore()
  const sourceDirs = useConfigStore(s => s.sourceDirs)

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