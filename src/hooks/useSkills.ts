import { useEffect } from 'react'
import { useSkillsStore } from '@/stores/skillsStore'
import { useConfigStore } from '@/stores/configStore'

export function useSkills() {
  const {
    tree,
    sourceDir,
    selectedFile,
    fileContent,
    originalContent,
    fileUpdatedAt,
    templates,
    searchQuery,
    searchResults,
    treeLoading,
    fileLoading,
    saving,
    error,
    unsavedChanges,
    editorMode,
    fetchTree,
    selectFile,
    updateContent,
    saveFile,
    setEditorMode,
    enterEditMode,
    cancelEdit,
    createFile,
    deleteFile,
    searchFiles,
    fetchTemplates,
    clearSelection,
  } = useSkillsStore()

  const { fetchConfig } = useConfigStore()

  useEffect(() => {
    fetchConfig()
    fetchTree()
    fetchTemplates()
  }, [fetchConfig, fetchTree, fetchTemplates])

  return {
    tree,
    sourceDir,
    selectedFile,
    fileContent,
    originalContent,
    fileUpdatedAt,
    templates,
    searchQuery,
    searchResults,
    treeLoading,
    fileLoading,
    saving,
    error,
    unsavedChanges,
    editorMode,
    selectFile,
    updateContent,
    saveFile,
    setEditorMode,
    enterEditMode,
    cancelEdit,
    createFile,
    deleteFile,
    searchFiles,
    fetchTemplates,
    clearSelection,
    refreshTree: fetchTree,
  }
}
