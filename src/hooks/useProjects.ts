import { useEffect } from 'react'
import { useProjectStore } from '@/stores/projectStore'

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

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

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
