import { useEffect } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { useConfigStore } from '@/stores/configStore'

export function useProjects() {
  const {
    projects,
    loading,
    error,
    searchQuery,
    fetchProjects,
    addProject,
    addProjects,
    autoDetect,
    removeProject,
    setSearchQuery,
    filteredProjects,
  } = useProjectStore()

  const { fetchConfig } = useConfigStore()

  useEffect(() => {
    fetchConfig()
    fetchProjects()
  }, [fetchConfig, fetchProjects])

  return {
    projects: filteredProjects(),
    allProjects: projects,
    loading,
    error,
    searchQuery,
    addProject,
    addProjects,
    autoDetect,
    removeProject,
    setSearchQuery,
    refreshProjects: fetchProjects,
  }
}
