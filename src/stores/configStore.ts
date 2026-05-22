import { create } from 'zustand'
import { configApi } from '@/api/client'
import type { ToolDefinition, AppPreferences, SourceDir, LLMModel } from '@/types'

interface ConfigState {
  sourceDir: string
  sourceDirs: SourceDir[]
  activeSourceDirId: string
  defaultModelId: string
  llmModels: LLMModel[]
  tools: ToolDefinition[]
  preferences: AppPreferences
  loading: boolean
  error: string | null
  configLoaded: boolean

  fetchConfig: () => Promise<void>
  updateConfig: (updates: {
    sourceDir?: string
    sourceDirs?: SourceDir[]
    activeSourceDirId?: string
    defaultModelId?: string
    llmModels?: LLMModel[]
    tools?: { type: string; enabled: boolean }[]
    preferences?: Partial<AppPreferences>
  }) => Promise<void>
  setActiveSourceDir: (id: string) => Promise<void>
  setDefaultModel: (id: string) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
}

export const useConfigStore = create<ConfigState>()((set, get) => ({
  sourceDir: '',
  sourceDirs: [],
  activeSourceDirId: '',
  defaultModelId: '',
  llmModels: [],
  tools: [],
  preferences: {
    theme: 'system',
    autoSync: false,
    backupBeforeReplace: true,
  },
  loading: false,
  error: null,
  configLoaded: false,

  fetchConfig: async () => {
    // Only load once to prevent overwriting local optimistic updates
    if (get().configLoaded) return
    set({ loading: true, error: null })
    try {
      const config = await configApi.get()
      const prefs = { ...get().preferences, ...config.preferences }
      set({
        sourceDir: config.sourceDir,
        sourceDirs: config.sourceDirs || [],
        activeSourceDirId: config.activeSourceDirId || '',
        defaultModelId: config.defaultModelId || '',
        llmModels: config.llmModels || [],
        tools: config.tools,
        preferences: prefs,
        loading: false,
        configLoaded: true,
      })
      // Apply theme
      applyTheme(prefs.theme || 'system')
    } catch (error) {
      set({ loading: false, error: 'Failed to load config' })
    }
  },

  updateConfig: async (updates) => {
    set({ loading: true, error: null })
    try {
      const config = await configApi.update(updates)
      set({
        sourceDir: config.sourceDir,
        sourceDirs: config.sourceDirs || [],
        activeSourceDirId: config.activeSourceDirId || '',
        defaultModelId: config.defaultModelId || get().defaultModelId,
        llmModels: config.llmModels || [],
        tools: config.tools,
        preferences: { ...get().preferences, ...config.preferences },
        loading: false,
      })
    } catch (error) {
      set({ loading: false, error: 'Failed to update config' })
    }
  },

  setActiveSourceDir: async (id) => {
    const { sourceDirs } = get()
    const active = sourceDirs.find(s => s.id === id)
    if (active) {
      set({ activeSourceDirId: id, sourceDir: active.path })
      // Save silently
      configApi.update({ activeSourceDirId: id }).catch(() => {})
    }
  },

  setDefaultModel: (id: string) => {
    set({ defaultModelId: id })
    // Save silently
    configApi.update({ defaultModelId: id }).catch(() => {})
  },

  setTheme: (theme) => {
    applyTheme(theme)
    set((state) => ({ preferences: { ...state.preferences, theme } }))
    // Save silently without triggering loading state
    configApi.update({ preferences: { theme } }).catch(() => {})
  },
}))

function applyTheme(theme: 'light' | 'dark' | 'system') {
  const root = document.documentElement
  if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', isDark)
  } else {
    root.classList.toggle('dark', theme === 'dark')
  }
}

