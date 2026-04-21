import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { FolderOpen, BookOpen, BarChart3, Home, ChevronLeft, ChevronRight, Download, Radar } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const navItems = [
  { path: '/home', label: '首页', icon: Home },
  { path: '/skills', label: 'Skills 库', icon: BookOpen },
  { path: '/radar', label: 'Skills 雷达', icon: Radar },
  { path: '/import', label: '导入中心', icon: Download },
  { path: '/projects', label: '项目管理', icon: FolderOpen },
  { path: '/analytics', label: '使用分析', icon: BarChart3 },
]

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={cn(
      'flex flex-col border-r bg-muted/30 py-4 transition-all duration-200',
      collapsed ? 'w-16 items-center' : 'w-48'
    )}>
      <div className={cn(
        'mb-6 flex h-10 items-center rounded-lg bg-primary text-primary-foreground font-bold text-sm',
        collapsed ? 'w-10 justify-center mx-auto' : 'mx-3 px-3 gap-2'
      )}>
        SM
        {!collapsed && <span className="text-xs font-normal opacity-80">Skills Manager</span>}
      </div>
      <nav className={cn(
        'flex flex-1 flex-col gap-1',
        collapsed ? 'items-center' : 'px-2'
      )}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          const Icon = item.icon

          const button = (
            <button
              onClick={() => navigate(item.path)}
              className={cn(
                'flex items-center rounded-lg transition-colors',
                collapsed ? 'h-10 w-10 justify-center' : 'h-10 w-full gap-3 px-3',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="text-sm">{item.label}</span>}
            </button>
          )

          if (collapsed) {
            return (
              <Tooltip key={item.path}>
                <TooltipTrigger asChild>
                  {button}
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
            )
          }

          return <div key={item.path}>{button}</div>
        })}
      </nav>
      <div className={cn('pt-2', collapsed ? 'flex justify-center' : 'px-2')}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
          title={collapsed ? '展开菜单' : '收起菜单'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  )
}
