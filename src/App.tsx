import { useEffect, useState, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { useConfigStore } from '@/stores/configStore'
import { useImportStore } from '@/stores/importStore'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import ProjectsPage from '@/pages/ProjectsPage'
import SkillsPage from '@/pages/SkillsPage'
// ToolsPage removed
import SkillsRadarPage from '@/pages/SkillsRadarPage'
import HelpPage from '@/pages/HelpPage'
import AnalyticsPage from '@/pages/AnalyticsPage'
import HomePage from '@/pages/HomePage'
import ImportPage from '@/pages/ImportPage'
import { Upload } from 'lucide-react'

/** Global drag-and-drop overlay + keyboard shortcut handler */
function GlobalHandlers() {
  const navigate = useNavigate()
  const { setActiveTab, resetWizard, setSelectedImportMethod } = useImportStore()
  const [isDragging, setIsDragging] = useState(false)

  // Global keyboard shortcut: Ctrl+I / Cmd+I → navigate to Import Center
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault()
        setActiveTab('import')
        resetWizard()
        navigate('/import')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate, setActiveTab, resetWizard])

  // Global drag-and-drop: dragging files into the window triggers import
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only hide overlay when leaving the window (relatedTarget is null)
    if (!e.relatedTarget || !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      // Navigate to import center with local import method selected
      setActiveTab('import')
      resetWizard()
      setSelectedImportMethod('local')
      navigate('/import')
    }
  }, [navigate, setActiveTab, resetWizard, setSelectedImportMethod])

  return (
    <div
      className="contents"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm border-4 border-dashed border-primary/50 pointer-events-none">
          <div className="flex flex-col items-center gap-3 text-primary">
            <Upload className="h-12 w-12 animate-bounce" />
            <p className="text-lg font-medium">Drop files here to import</p>
            <p className="text-sm text-muted-foreground">Release to open Import Center</p>
          </div>
        </div>
      )}
    </div>
  )
}

function App() {
  const fetchConfig = useConfigStore(s => s.fetchConfig)
  useEffect(() => { fetchConfig() }, [fetchConfig])

  return (
    <BrowserRouter>
      <div className="flex h-screen flex-col bg-background">
        <div className="flex flex-1 min-h-0">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto p-6">
            <Routes>
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/skills" element={<SkillsPage />} />
              <Route path="/radar" element={<SkillsRadarPage />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/links" element={<Navigate to="/projects" replace />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/help" element={<HelpPage />} />
            </Routes>
          </main>
        </div>
        </div>
        {/* Bottom Banner */}
        <div className="flex items-center justify-center border-t bg-muted/30 px-4 py-1 text-xs text-muted-foreground shrink-0">
          Power by{' '}
          <a
            href="dingtalk://dingtalkclient/action/sendmsg?dingtalk_id=c090tar"
            className="ml-1 font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            @阿航
          </a>
        </div>
      </div>
      <GlobalHandlers />
      <Toaster />
    </BrowserRouter>
  )
}

export default App
