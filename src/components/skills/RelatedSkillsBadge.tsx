import { Link2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface RelatedSkillsBadgeProps {
  related: string[]
  /** 当前所有 Skill 名称（用于判断引用是否存在）。可选 */
  knownSkillNames?: Set<string>
  /** 点击某个相关 Skill 时触发，参数为 Skill 名称 */
  onJump?: (skillName: string) => void
  /** 紧凑模式，仅显示数量；非紧凑显示 "N 个相关" */
  compact?: boolean
}

export default function RelatedSkillsBadge({
  related,
  knownSkillNames,
  onJump,
  compact = true,
}: RelatedSkillsBadgeProps) {
  if (!related || related.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-cyan-700 bg-cyan-100 hover:bg-cyan-200 dark:text-cyan-300 dark:bg-cyan-950/50 dark:hover:bg-cyan-900/60 cursor-pointer transition-colors outline-none"
        title={`相关 Skills: ${related.join(', ')}`}
        onClick={(e) => e.stopPropagation()}
      >
        <Link2 className="h-3 w-3" />
        {compact ? related.length : `${related.length} 个相关`}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align="start"
        className="w-64"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2 py-1.5 text-xs font-semibold flex items-center gap-1.5">
          <Link2 className="h-3 w-3 text-cyan-600" />
          相关 Skills
        </div>
        <DropdownMenuSeparator />
        {related.map((name) => {
          const exists = !knownSkillNames || knownSkillNames.has(name)
          return (
            <DropdownMenuItem
              key={name}
              disabled={!exists}
              onClick={(e) => {
                e.stopPropagation()
                if (exists && onJump) onJump(name)
              }}
              className="text-xs"
            >
              <code className="text-[11px] flex-1">{name}</code>
              {!exists && (
                <span className="text-[10px] text-muted-foreground italic ml-2">
                  未找到
                </span>
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
