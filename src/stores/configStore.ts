import { create } from 'zustand'
import { configApi } from '@/api/client'
import type { ToolDefinition, AppPreferences, UIStyle, SourceDir, LLMModel } from '@/types'

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
  setUIStyle: (style: UIStyle) => void
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
    uiStyle: 'default',
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
      // Apply theme and UI style
      applyTheme(prefs.theme || 'system')
      applyUIStyle(prefs.uiStyle || 'default')
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

  setUIStyle: (style) => {
    applyUIStyle(style)
    set((state) => ({ preferences: { ...state.preferences, uiStyle: style } }))
    // Save silently without triggering loading state
    configApi.update({ preferences: { uiStyle: style } }).catch(() => {})
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

// Preload pixel font at module init
;(async () => {
  try {
    const font = new FontFace('ArkPixel', "url('/fonts/ark-pixel-12px-proportional-zh_cn.ttf.woff2') format('woff2')")
    const loaded = await font.load()
    document.fonts.add(loaded)
  } catch {
    // Font load failed, pixel style will use fallback font
  }
})()

function applyUIStyle(style: UIStyle) {
  const root = document.documentElement
  const isCurrentlyPixel = root.classList.contains('pixel')
  const wantsPixel = style === 'pixel'

  // No change needed
  if (isCurrentlyPixel === wantsPixel) return

  // Create a solid overlay to mask the transition
  const overlay = document.createElement('div')
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 99999;
    background: ${wantsPixel ? '#1c2035' : (root.classList.contains('dark') ? '#0a0a0a' : '#ffffff')};
    opacity: 1;
    pointer-events: none;
    transition: opacity 0.15s ease-out;
  `
  document.body.appendChild(overlay)

  // Disable transitions, apply class change
  root.classList.add('no-transition')
  root.classList.toggle('pixel', wantsPixel)

  // Force reflow
  void root.offsetHeight

  // Fade out overlay to reveal new style smoothly
  requestAnimationFrame(() => {
    overlay.style.opacity = '0'
    root.classList.remove('no-transition')

    overlay.addEventListener('transitionend', () => {
      overlay.remove()
    })

    // Safety cleanup in case transitionend doesn't fire
    setTimeout(() => {
      if (overlay.parentNode) overlay.remove()
    }, 300)
  })
}
