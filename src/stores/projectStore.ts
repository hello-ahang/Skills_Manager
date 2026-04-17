import { create } from 'zustand'
import { projectsApi } from '@/api/client'
import type { Project } from '@/types'

interface ProjectState {
  projects: Project[]
  loading: boolean
  error: string | null
  searchQuery: string

  fetchProjects: () => Promise<void>
  addProject: (path: string, name?: string) => Promise<void>
  addProjects: (items: { path: string; name?: string }[]) => Promise<{ added: any[]; errors: { path: string; error: string }[] }>
  autoDetect: () => Promise<{ added: any[]; total: number }>
  removeProject: (id: string) => Promise<void>
  setSearchQuery: (query: string) => void
  filteredProjects: () => Project[]
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  projects: [],
  loading: false,
  error: null,
  searchQuery: '',

  fetchProjects: async () => {
    set({ loading: true, error: null })
    try {
      const data = await projectsApi.getAll()
      set({ projects: data.projects, loading: false })
    } catch (error) {
      set({ loading: false, error: 'Failed to load projects' })
    }
  },

  addProject: async (path, name) => {
    set({ loading: true, error: null })
    try {
      const result = await projectsApi.add({ path, name })
      // Handle both formats: { added: [...] } (new) or direct project object (legacy)
      const project = result.added ? result.added[0] : result
      if (project) {
        set((state) => ({
          projects: [...state.projects, project],
          loading: false,
        }))
      } else {
        set({ loading: false })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add project'
      set({ loading: false, error: message })
      throw error
    }
  },

  addProjects: async (items: { path: string; name?: string }[]) => {
    set({ loading: true, error: null })
    try {
      const result = await projectsApi.addBatch(items)
      if (result.added.length > 0) {
        set((state) => ({
          projects: [...state.projects, ...result.added],
          loading: false,
        }))
      } else {
        set({ loading: false })
      }
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add projects'
      set({ loading: false, error: message })
      throw error
    }
  },

  autoDetect: async () => {
    try {
      const result = await projectsApi.autoDetect()
      if (result.added.length > 0) {
        // Refresh full project list after auto-detect
        const data = await projectsApi.getAll()
        set({ projects: data.projects })
      }
      return result
    } catch (error) {
      console.error('Auto-detect failed:', error)
      return { added: [], total: 0 }
    }
  },

  removeProject: async (id) => {
    try {
      await projectsApi.remove(id)
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
      }))
    } catch (error) {
      set({ error: 'Failed to remove project' })
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  filteredProjects: () => {
    const { projects, searchQuery } = get()
    if (!searchQuery) return projects
    const q = searchQuery.toLowerCase()
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.path.toLowerCase().includes(q)
    )
  },
}))
