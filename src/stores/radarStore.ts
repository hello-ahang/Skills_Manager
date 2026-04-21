import { create } from 'zustand'
import { useConfigStore } from './configStore'

// ==================== Types ====================

export interface RadarSkillSource {
  source: string
  sourceName: string
}

export interface RadarSkillItem {
  name: string
  description?: string
  source: 'library' | 'project' | 'import-history'
  sourceName: string
  sources?: RadarSkillSource[]
  path?: string
  realPath?: string
  contentSummary?: string
  version?: string
  tags?: string[]
  category?: string
}

export interface RadarSearchResult {
  name: string
  score: number
  reason: string
}

export interface RadarCategory {
  name: string
  count: number
  skills: string[]
  description: string
}

export interface RadarSummary {
  categories: RadarCategory[]
  totalCount: number
  summary: string
}

// ==================== Server-side Cache API ====================

async function loadCachedTagsFromServer(): Promise<Record<string, string[]>> {
  try {
    const res = await fetch('/api/radar/cache/tags')
    if (!res.ok) return {}
    const data = await res.json()
    return data.tags || {}
  } catch {
    return {}
  }
}

async function saveCachedTagsToServer(tags: Record<string, string[]>): Promise<void> {
  try {
    await fetch('/api/radar/cache/tags', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    })
  } catch {
    // Silent fail
  }
}

async function loadCachedSummaryFromServer(): Promise<RadarSummary | null> {
  try {
    const res = await fetch('/api/radar/cache/summary')
    if (!res.ok) return null
    const data = await res.json()
    return data.summary || null
  } catch {
    return null
  }
}

async function saveCachedSummaryToServer(summary: RadarSummary): Promise<void> {
  try {
    await fetch('/api/radar/cache/summary', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary }),
    })
  } catch {
    // Silent fail
  }
}

// ==================== Store ====================

interface RadarState {
  skills: RadarSkillItem[]
  loading: boolean
  error: string | null

  searchQuery: string
  searchResults: RadarSearchResult[]
  searching: boolean
  searchError: string | null

  summary: RadarSummary | null
  summarizing: boolean
  summaryError: string | null

  tags: Record<string, string[]>
  tagging: boolean
  tagError: string | null

  // Filter state
  sourceFilter: string
  tagFilter: string

  // Cache loading state
  cacheLoaded: boolean

  fetchSkills: () => Promise<void>
  loadCache: () => Promise<void>
  aiSearch: (query: string) => Promise<void>
  generateSummary: () => Promise<void>
  generateTags: () => Promise<void>
  setSourceFilter: (filter: string) => void
  setTagFilter: (filter: string) => void
  clearSearch: () => void
}

function getSelectedModel() {
  const { llmModels, defaultModelId } = useConfigStore.getState()
  // Prefer default model
  if (defaultModelId) {
    const defaultModel = llmModels.find(m => m.id === defaultModelId && m.tested)
    if (defaultModel) return defaultModel
  }
  // Fallback to first tested model
  const testedModels = llmModels.filter(m => m.tested)
  return testedModels[0] || null
}

export const useRadarStore = create<RadarState>()((set, get) => ({
  skills: [],
  loading: false,
  error: null,

  searchQuery: '',
  searchResults: [],
  searching: false,
  searchError: null,

  summary: null,
  summarizing: false,
  summaryError: null,

  tags: {},
  tagging: false,
  tagError: null,

  sourceFilter: 'all',
  tagFilter: 'all',

  cacheLoaded: false,

  loadCache: async () => {
    if (get().cacheLoaded) return
    const [tags, summary] = await Promise.all([
      loadCachedTagsFromServer(),
      loadCachedSummaryFromServer(),
    ])
    set({ tags, summary, cacheLoaded: true })
  },

  fetchSkills: async () => {
    set({ loading: true, error: null })
    try {
      // Ensure cache is loaded first
      if (!get().cacheLoaded) {
        await get().loadCache()
      }

      const res = await fetch('/api/radar/skills')
      if (!res.ok) throw new Error('Failed to fetch skills')
      const data = await res.json()

      // Merge cached tags into skills
      const cachedTags = get().tags
      const skills = (data.skills as RadarSkillItem[]).map(s => ({
        ...s,
        tags: cachedTags[s.name] || s.tags,
      }))

      set({ skills, loading: false })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to fetch skills' })
    }
  },

  aiSearch: async (query: string) => {
    const model = getSelectedModel()
    if (!model) {
      set({ searchError: '请先在设置中配置并测试 AI 模型' })
      return
    }

    set({ searchQuery: query, searching: true, searchError: null, searchResults: [] })
    try {
      const { skills } = get()
      const res = await fetch('/api/radar/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          skills: skills.map(s => ({ name: s.name, description: s.description, contentSummary: s.contentSummary })),
          baseUrl: model.baseUrl,
          apiKey: model.apiKey,
          modelName: model.modelName,
        }),
        signal: AbortSignal.timeout(120000),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Search failed' }))
        throw new Error(errData.error || 'Search failed')
      }

      const data = await res.json()
      set({ searchResults: data.results || [], searching: false })
    } catch (err) {
      set({ searching: false, searchError: err instanceof Error ? err.message : 'Search failed' })
    }
  },

  generateSummary: async () => {
    const model = getSelectedModel()
    if (!model) {
      set({ summaryError: '请先在设置中配置并测试 AI 模型' })
      return
    }

    set({ summarizing: true, summaryError: null })
    try {
      const { skills } = get()
      const res = await fetch('/api/radar/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skills: skills.map(s => ({ name: s.name, description: s.description })),
          baseUrl: model.baseUrl,
          apiKey: model.apiKey,
          modelName: model.modelName,
        }),
        signal: AbortSignal.timeout(180000),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Summary generation failed' }))
        throw new Error(errData.error || 'Summary generation failed')
      }

      const data = await res.json()
      const summary = data.summary as RadarSummary
      // Save to server-side file
      saveCachedSummaryToServer(summary)
      set({ summary, summarizing: false })
    } catch (err) {
      set({ summarizing: false, summaryError: err instanceof Error ? err.message : 'Summary failed' })
    }
  },

  generateTags: async () => {
    const model = getSelectedModel()
    if (!model) {
      set({ tagError: '请先在设置中配置并测试 AI 模型' })
      return
    }

    set({ tagging: true, tagError: null })
    try {
      const { skills } = get()
      // Only tag skills that don't have tags yet
      const untagged = skills.filter(s => !s.tags || s.tags.length === 0)
      if (untagged.length === 0) {
        set({ tagging: false })
        return
      }

      const res = await fetch('/api/radar/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skills: untagged.map(s => ({ name: s.name, description: s.description })),
          baseUrl: model.baseUrl,
          apiKey: model.apiKey,
          modelName: model.modelName,
        }),
        signal: AbortSignal.timeout(180000),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Tag generation failed' }))
        throw new Error(errData.error || 'Tag generation failed')
      }

      const data = await res.json()
      const newTags = data.tags as Record<string, string[]>

      // Merge with existing tags
      const mergedTags = { ...get().tags, ...newTags }
      // Save to server-side file
      saveCachedTagsToServer(mergedTags)

      // Update skills with new tags
      const updatedSkills = get().skills.map(s => ({
        ...s,
        tags: mergedTags[s.name] || s.tags,
      }))

      set({ tags: mergedTags, skills: updatedSkills, tagging: false })
    } catch (err) {
      set({ tagging: false, tagError: err instanceof Error ? err.message : 'Tag generation failed' })
    }
  },

  setSourceFilter: (filter: string) => set({ sourceFilter: filter }),
  setTagFilter: (filter: string) => set({ tagFilter: filter }),
  clearSearch: () => set({ searchQuery: '', searchResults: [], searchError: null }),
}))
