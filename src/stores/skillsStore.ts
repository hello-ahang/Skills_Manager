import { create } from 'zustand'
import { skillsApi } from '@/api/client'
import type { FileTreeNode, SkillTemplate } from '@/types'

export type EditorMode = 'preview' | 'edit' | 'diff' | 'markdown-preview'

// ─── Skill Aliases (localStorage persistence) ──────────────────────────────

const SKILL_ALIASES_KEY = 'skill-aliases'

function loadSkillAliases(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SKILL_ALIASES_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveSkillAliases(aliases: Record<string, string>) {
  localStorage.setItem(SKILL_ALIASES_KEY, JSON.stringify(aliases))
}

// ─── Store Interface ────────────────────────────────────────────────────────

interface SkillsState {
  tree: FileTreeNode[]
  sourceDir: string
  selectedFile: string | null
  fileContent: string
  originalContent: string
  fileUpdatedAt: string
  templates: SkillTemplate[]
  searchQuery: string
  searchResults: { path: string; matches: { line: number; text: string }[] }[]
  treeLoading: boolean
  fileLoading: boolean
  saving: boolean
  error: string | null
  unsavedChanges: boolean
  editorMode: EditorMode

  // Skill aliases
  skillAliases: Record<string, string>
  setSkillAlias: (dirPath: string, alias: string) => void
  removeSkillAlias: (dirPath: string) => void

  fetchTree: () => Promise<void>
  selectFile: (path: string) => Promise<void>
  updateContent: (content: string) => void
  saveFile: () => Promise<void>
  setEditorMode: (mode: EditorMode) => void
  enterEditMode: () => void
  cancelEdit: () => void
  createFile: (path: string, content?: string, templateId?: string, variables?: Record<string, string>) => Promise<void>
  deleteFile: (path: string) => Promise<void>
  searchFiles: (query: string) => Promise<void>
  fetchTemplates: () => Promise<void>
  clearSelection: () => void
}

export const useSkillsStore = create<SkillsState>()((set, get) => ({
  tree: [],
  sourceDir: '',
  selectedFile: null,
  fileContent: '',
  originalContent: '',
  fileUpdatedAt: '',
  templates: [],
  searchQuery: '',
  searchResults: [],
  treeLoading: false,
  fileLoading: false,
  saving: false,
  error: null,
  unsavedChanges: false,
  editorMode: 'preview' as EditorMode,

  // Skill aliases
  skillAliases: loadSkillAliases(),

  setSkillAlias: (dirPath, alias) => {
    const updated = { ...get().skillAliases, [dirPath]: alias }
    saveSkillAliases(updated)
    set({ skillAliases: updated })
  },

  removeSkillAlias: (dirPath) => {
    const updated = { ...get().skillAliases }
    delete updated[dirPath]
    saveSkillAliases(updated)
    set({ skillAliases: updated })
  },

  fetchTree: async (sourceDirId?: string) => {
    set({ treeLoading: true, error: null })
    try {
      const data = await skillsApi.getTree(sourceDirId)
      set({ tree: data.tree, sourceDir: data.sourceDir, treeLoading: false })
    } catch (error) {
      set({ treeLoading: false, error: 'Failed to load skills tree' })
    }
  },

  selectFile: async (path) => {
    set({ fileLoading: true, error: null, selectedFile: path, editorMode: 'preview' })
    try {
      const data = await skillsApi.getFile(path)
      set({
        fileContent: data.content,
        originalContent: data.content,
        fileUpdatedAt: data.updatedAt,
        fileLoading: false,
        unsavedChanges: false,
        editorMode: 'preview',
      })
    } catch (error) {
      set({ fileLoading: false, error: 'Failed to load file' })
    }
  },

  updateContent: (content) => {
    set({ fileContent: content, unsavedChanges: true })
  },

  saveFile: async () => {
    const { selectedFile, fileContent } = get()
    if (!selectedFile) return

    set({ saving: true, error: null })
    try {
      await skillsApi.saveFile(selectedFile, fileContent)
      set({
        saving: false,
        unsavedChanges: false,
        originalContent: fileContent,
        editorMode: 'preview',
      })
    } catch (error) {
      set({ saving: false, error: 'Failed to save file' })
    }
  },

  setEditorMode: (mode) => {
    set({ editorMode: mode })
  },

  enterEditMode: () => {
    set({ editorMode: 'edit' })
  },

  cancelEdit: () => {
    const { originalContent } = get()
    set({
      fileContent: originalContent,
      unsavedChanges: false,
      editorMode: 'preview',
    })
  },

  createFile: async (path, content, templateId, variables) => {
    set({ treeLoading: true, error: null })
    try {
      await skillsApi.createFile({ path, content, templateId, variables })
      await get().fetchTree()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create file'
      set({ treeLoading: false, error: message })
      throw error
    }
  },

  deleteFile: async (path) => {
    set({ treeLoading: true, error: null })
    try {
      await skillsApi.deleteFile(path)
      const { selectedFile } = get()
      if (selectedFile === path) {
        set({ selectedFile: null, fileContent: '', unsavedChanges: false })
      }
      await get().fetchTree()
    } catch (error) {
      set({ treeLoading: false, error: 'Failed to delete file' })
    }
  },

  searchFiles: async (query) => {
    set({ searchQuery: query, treeLoading: true, error: null })
    try {
      if (!query.trim()) {
        set({ searchResults: [], treeLoading: false })
        return
      }
      const data = await skillsApi.search(query)
      set({ searchResults: data.results, treeLoading: false })
    } catch (error) {
      set({ treeLoading: false, error: 'Failed to search files' })
    }
  },

  fetchTemplates: async () => {
    try {
      const data = await skillsApi.getTemplates()
      set({ templates: data.templates })
    } catch (error) {
      console.error('Failed to load templates:', error)
    }
  },

  clearSelection: () => {
    set({ selectedFile: null, fileContent: '', unsavedChanges: false })
  },
}))
