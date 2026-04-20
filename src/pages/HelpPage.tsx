import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, BookOpen, FileText } from 'lucide-react'

type TabKey = 'readme' | 'changelog'

const TABS: { key: TabKey; label: string; icon: typeof BookOpen; endpoint: string }[] = [
  { key: 'readme', label: '产品介绍', icon: BookOpen, endpoint: '/api/config/readme' },
  { key: 'changelog', label: '更新日志', icon: FileText, endpoint: '/api/config/changelog' },
]

export default function HelpPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('readme')
  const [contents, setContents] = useState<Record<TabKey, string>>({ readme: '', changelog: '' })
  const [loadingStates, setLoadingStates] = useState<Record<TabKey, boolean>>({ readme: true, changelog: false })
  const [errors, setErrors] = useState<Record<TabKey, string>>({ readme: '', changelog: '' })

  useEffect(() => {
    // 已加载过则跳过
    if (contents[activeTab] || loadingStates[activeTab]) return

    setLoadingStates(prev => ({ ...prev, [activeTab]: true }))

    const tab = TABS.find(t => t.key === activeTab)!
    fetch(tab.endpoint)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load')
        return res.json()
      })
      .then(data => {
        setContents(prev => ({ ...prev, [activeTab]: data.content }))
        setLoadingStates(prev => ({ ...prev, [activeTab]: false }))
      })
      .catch(err => {
        setErrors(prev => ({ ...prev, [activeTab]: err.message }))
        setLoadingStates(prev => ({ ...prev, [activeTab]: false }))
      })
  }, [activeTab])

  // 首次加载 readme
  useEffect(() => {
    fetch('/api/config/readme')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load')
        return res.json()
      })
      .then(data => {
        setContents(prev => ({ ...prev, readme: data.content }))
        setLoadingStates(prev => ({ ...prev, readme: false }))
      })
      .catch(err => {
        setErrors(prev => ({ ...prev, readme: err.message }))
        setLoadingStates(prev => ({ ...prev, readme: false }))
      })
  }, [])

  const isLoading = loadingStates[activeTab]
  const error = errors[activeTab]
  const content = contents[activeTab]

  return (
    <div className="mx-auto max-w-4xl">
      {/* Tab 栏 */}
      <div className="flex border-b border-border px-6 pt-4">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* 内容区 */}
      {isLoading ? (
        <div className="flex h-[calc(100vh-14rem)] items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">加载文档...</span>
          </div>
        </div>
      ) : error ? (
        <div className="flex h-[calc(100vh-14rem)] items-center justify-center">
          <p className="text-sm text-destructive">加载失败: {error}</p>
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-12rem)]">
          <div className="prose prose-sm dark:prose-invert max-w-none p-6">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
              {content}
            </ReactMarkdown>
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
