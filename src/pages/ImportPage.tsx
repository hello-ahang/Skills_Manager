import { useImportStore } from '@/stores/importStore'
import { useConfigStore } from '@/stores/configStore'
import ImportWizard from '@/components/import/ImportWizard'
import GitRepoImporter from '@/components/import/GitRepoImporter'
import LocalImporter from '@/components/import/LocalImporter'
import ZipImporter from '@/components/import/ZipImporter'
import ClipboardImporter from '@/components/import/ClipboardImporter'
import BatchImporter from '@/components/import/BatchImporter'
import ImportHistory from '@/components/import/ImportHistory'
import SubscriptionManager from '@/components/import/SubscriptionManager'
import ImportSettings from '@/components/import/ImportSettings'
import ImportAnalytics from '@/components/import/ImportAnalytics'
import ClawHubImporter from '@/components/import/ClawHubImporter'
import {
  Download, History, Bell, Settings, BarChart3, Plus,
  GitBranch, FolderOpen, Archive, ClipboardPaste, Link2,
  AlertCircle, Sparkles,
} from 'lucide-react'

/* ── Import method definitions ── */
const importMethods = [
  { id: 'git' as const, label: 'GitHub', icon: GitBranch },
  { id: 'clawhub' as const, label: 'ClawHub', icon: Sparkles },
  { id: 'local' as const, label: '本地文件', icon: FolderOpen },
  { id: 'zip' as const, label: 'ZIP 压缩包', icon: Archive },
  { id: 'clipboard' as const, label: '剪贴板', icon: ClipboardPaste },
  { id: 'batch' as const, label: '批量导入', icon: Link2 },
]

/* ── Right panel tabs ── */
const panelTabs = [
  { id: 'history' as const, label: '历史', icon: History },
  { id: 'subscriptions' as const, label: '订阅', icon: Bell },
  { id: 'stats' as const, label: '统计', icon: BarChart3 },
  { id: 'settings' as const, label: '设置', icon: Settings },
]

export default function ImportPage() {
  const {
    activeTab, setActiveTab, importStep, resetWizard,
    selectedImportMethod, setSelectedImportMethod,
    importOptions, setImportOptions, scanError,
  } = useImportStore()

  const sourceDirs = useConfigStore(s => s.sourceDirs)
  const activeSourceDirId = useConfigStore(s => s.activeSourceDirId)

  const isImportActive = activeTab === 'import'
  const isStep1 = importStep === 1

  // Determine which import modes to show based on method
  const showImportMode = selectedImportMethod === 'local'
  const localModes = [
    { value: 'copy', label: '📋 复制' },
    { value: 'move', label: '🔄 移动' },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Download className="h-6 w-6" />
            导入中心
          </h1>
        </div>
        {!isImportActive && (
          <button
            onClick={() => { setActiveTab('import'); resetWizard() }}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            新建导入
          </button>
        )}
      </div>

      {/* ── Main layout: Left import area + Right management panel ── */}
      <div className="flex gap-6 items-start">
        {/* Left: Import area (~70%) */}
        <div className="flex-1 min-w-0">
          {isImportActive ? (
            <div className="rounded-lg border-2 border-primary/20 bg-card overflow-hidden">
              {isStep1 ? (
                /* Step 1: Left nav + Right form */
                <div className="flex min-h-[400px]">
                  {/* Left: method navigation */}
                  <div className="w-36 shrink-0 border-r bg-muted/20">
                    <div className="p-2 space-y-0.5">
                      {importMethods.map((method) => {
                        const Icon = method.icon
                        const isActive = selectedImportMethod === method.id
                        return (
                          <button
                            key={method.id}
                            onClick={() => setSelectedImportMethod(method.id)}
                            className={`w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors text-left ${
                              isActive
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{method.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Right: form + config */}
                  <div className="flex-1 flex flex-col">
                    {/* Form area */}
                    <div className="flex-1 p-5 overflow-auto">
                      <div className="space-y-4">
                        {selectedImportMethod === 'git' && <GitRepoImporter />}
                        {selectedImportMethod === 'clawhub' && <ClawHubImporter />}
                        {selectedImportMethod === 'local' && <LocalImporter />}
                        {selectedImportMethod === 'zip' && <ZipImporter />}
                        {selectedImportMethod === 'clipboard' && <ClipboardImporter />}
                        {selectedImportMethod === 'batch' && <BatchImporter />}

                        {scanError && (
                          <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-500">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {scanError}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom config bar */}
                    <div className="border-t bg-muted/10 p-4 space-y-3">
                      {/* Target Skills Library */}
                      {sourceDirs.length > 0 && (
                        <div className="flex items-center gap-3">
                          <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">导入到</label>
                          <div className="flex gap-1.5 flex-wrap">
                            {sourceDirs.map((dir) => {
                              const isSelected = (importOptions.targetSourceDirId || activeSourceDirId) === dir.id
                              return (
                                <button
                                  key={dir.id}
                                  onClick={() => setImportOptions({ targetSourceDirId: dir.id })}
                                  className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                                    isSelected
                                      ? 'border-primary bg-primary/10 text-primary font-medium'
                                      : 'hover:bg-muted text-muted-foreground'
                                  }`}
                                >
                                  {dir.name}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Import mode — only for local */}
                      {showImportMode && (
                        <div className="flex items-center gap-3">
                          <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">模式</label>
                          <div className="flex gap-1.5">
                            {localModes.map((mode) => (
                              <button
                                key={mode.value}
                                onClick={() => setImportOptions({ importMode: mode.value as any })}
                                className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                                  importOptions.importMode === mode.value
                                    ? 'border-primary bg-primary/10 text-primary font-medium'
                                    : 'hover:bg-muted text-muted-foreground'
                                }`}
                              >
                                {mode.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Step 2/3/4: Full-width wizard */
                <div className="p-6">
                  <ImportWizard />
                </div>
              )}
            </div>
          ) : (
            /* Non-import tab content */
            <div className="rounded-lg border bg-card p-6">
              {activeTab === 'history' && <ImportHistory />}
              {activeTab === 'subscriptions' && <SubscriptionManager />}
              {activeTab === 'stats' && <ImportAnalytics />}
              {activeTab === 'settings' && <ImportSettings />}
            </div>
          )}
        </div>

        {/* Right: Management panel (~30%) */}
        <div className="w-48 shrink-0 space-y-1">
          {/* Import button at top */}
          <button
            onClick={() => { setActiveTab('import'); if (!isImportActive) resetWizard() }}
            className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors text-left ${
              isImportActive
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Download className="h-4 w-4 shrink-0" />
            <span>导入</span>
          </button>

          <div className="border-t my-1" />

          {/* Panel tabs */}
          {panelTabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors text-left ${
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Help text */}
      <p className="text-center text-xs text-muted-foreground">
        支持 GitHub、ClawHub 等主流平台，以及本地文件、ZIP、剪贴板等多种导入方式
      </p>
    </div>
  )
}