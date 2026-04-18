import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { useConfigStore } from '@/stores/configStore'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import ProjectsPage from '@/pages/ProjectsPage'
import SkillsPage from '@/pages/SkillsPage'
// ToolsPage removed
import HelpPage from '@/pages/HelpPage'
import AnalyticsPage from '@/pages/AnalyticsPage'
import HomePage from '@/pages/HomePage'
import ImportPage from '@/pages/ImportPage'

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
      <Toaster />
    </BrowserRouter>
  )
}

export default App
