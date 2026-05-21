import { create } from 'zustand'
import { toast } from 'sonner'
import { useConfigStore } from './configStore'

// Magic key used as the dirKey when "all source dirs" view is selected.
const ALL_DIRS_KEY = '__all__'

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
  rubricGrade?: 'A' | 'B' | 'C' | 'D' | 'F'
  rubricScore?: number
  usageCount?: number
}

export interface RadarSearchResult {
  name: string
  score: number
  reason: string
  rubricGrade?: 'A' | 'B' | 'C' | 'D' | 'F'
  rubricScore?: number
  usageCount?: number
  compositeScore?: number
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
  // Throws on network/server failure — callers MUST await and surface the
  // error to the user via toast. The previous fire-and-forget pattern lost
  // failures silently, leaving the UI showing tags that were never persisted.
  const res = await fetch('/api/radar/cache/tags', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags }),
  })
  if (!res.ok) {
    throw new Error(`保存标签缓存失败: HTTP ${res.status}`)
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
  // Throws on network/server failure — callers MUST await and surface the
  // error. Previous silent catch lost failures (review H6).
  const res = await fetch('/api/radar/cache/summary', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary }),
  })
  if (!res.ok) {
    throw new Error(`保存摘要缓存失败: HTTP ${res.status}`)
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
  summaryMap: Record<string, RadarSummary>
  currentSourceDirId: string
  summarizing: boolean
  summaryError: string | null

  tags: Record<string, string[]>
  tagging: boolean
  tagError: string | null

  // Filter state
  sourceFilter: string
  tagFilter: string
  gradeFilter: string

  // Cache loading state
  cacheLoaded: boolean

  fetchSkills: (sourceDirId?: string) => Promise<void>
  loadCache: () => Promise<void>
  aiSearch: (query: string) => Promise<void>
  generateSummary: (sourceDirId?: string) => Promise<void>
  generateTags: () => Promise<void>
  setSourceFilter: (filter: string) => void
  setTagFilter: (filter: string) => void
  setGradeFilter: (filter: string) => void
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
  summaryMap: {},
  currentSourceDirId: '',
  summarizing: false,
  summaryError: null,

  tags: {},
  tagging: false,
  tagError: null,

  sourceFilter: 'all',
  tagFilter: 'all',
  gradeFilter: 'all',

  cacheLoaded: false,

  loadCache: async () => {
    if (get().cacheLoaded) return
    const [tags, summary] = await Promise.all([
      loadCachedTagsFromServer(),
      loadCachedSummaryFromServer(),
    ])
    const summaryMap = summary ? { ...get().summaryMap, [ALL_DIRS_KEY]: summary } : get().summaryMap
    set({ tags, summary, summaryMap, cacheLoaded: true })
  },

  fetchSkills: async (sourceDirId?: string) => {
    const dirKey = sourceDirId || ALL_DIRS_KEY
    set({ loading: true, error: null, currentSourceDirId: dirKey })
    try {
      // Ensure cache is loaded first
      if (!get().cacheLoaded) {
        await get().loadCache()
      }

      const url = sourceDirId
        ? `/api/radar/skills?sourceDirId=${encodeURIComponent(sourceDirId)}`
        : '/api/radar/skills'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch skills')
      const data = await res.json()

      // Merge cached tags into skills
      const cachedTags = get().tags
      const skills = (data.skills as RadarSkillItem[]).map(s => ({
        ...s,
        tags: cachedTags[s.name] || s.tags,
      }))

      // Restore summary from summaryMap if available for this sourceDirId
      const cachedSummary = get().summaryMap[dirKey] || null
      set({ skills, loading: false, summary: cachedSummary })
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

  generateSummary: async (sourceDirId?: string) => {
    const model = getSelectedModel()
    if (!model) {
      set({ summaryError: '请先在设置中配置并测试 AI 模型' })
      return
    }

    set({ summarizing: true, summaryError: null })
    try {
      const { skills, currentSourceDirId } = get()
      const dirKey = sourceDirId !== undefined ? (sourceDirId || ALL_DIRS_KEY) : currentSourceDirId
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
      // Persist to server-side cache. Failures must surface — silently
      // swallowing them leaves the UI showing data that was never saved.
      try {
        await saveCachedSummaryToServer(summary)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '保存摘要缓存失败')
      }
      // Store in summaryMap keyed by sourceDirId
      const summaryMap = { ...get().summaryMap, [dirKey]: summary }
      set({ summary, summaryMap, summarizing: false })
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
      // Persist to server-side cache; toast on failure rather than swallow.
      try {
        await saveCachedTagsToServer(mergedTags)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '保存标签缓存失败')
      }

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
  setGradeFilter: (filter: string) => set({ gradeFilter: filter }),
  clearSearch: () => set({ searchQuery: '', searchResults: [], searchError: null }),
}))
