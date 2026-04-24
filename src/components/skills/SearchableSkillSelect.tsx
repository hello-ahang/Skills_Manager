import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface SearchableSkillSelectProps {
  /** 当前选中的 skill name */
  value: string
  /** 选中回调 */
  onValueChange: (value: string) => void
  /** Skills 列表（name + description） */
  skills: Array<{ name: string; description?: string }>
  /** 未选中时的占位文案 */
  placeholder?: string
  /** 自定义宽度等样式（如 w-56, flex-1） */
  className?: string
  /** 尺寸：sm=h-8 text-xs / default=h-9 text-sm */
  size?: 'sm' | 'default'
}

export default function SearchableSkillSelect({
  value,
  onValueChange,
  skills,
  placeholder = '选择 Skill',
  className,
  size = 'default',
}: SearchableSkillSelectProps) {
  const [open, setOpen] = useState(false)

  const isSm = size === 'sm'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'justify-between font-normal',
            isSm ? 'h-8 text-xs' : 'h-9 text-sm',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <span className="truncate">
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="搜索 Skill..." className={isSm ? 'h-8 text-xs' : 'h-9 text-sm'} />
          <CommandList>
            <CommandEmpty>未找到匹配的 Skill</CommandEmpty>
            <CommandGroup>
              {skills.map((s) => (
                <CommandItem
                  key={s.name}
                  value={s.name}
                  onSelect={() => {
                    onValueChange(s.name === value ? '' : s.name)
                    setOpen(false)
                  }}
                  className={isSm ? 'text-xs py-1.5' : 'text-sm py-2'}
                >
                  <Check
                    className={cn(
                      'h-3.5 w-3.5 shrink-0',
                      value === s.name ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="font-medium shrink-0">{s.name}</span>
                  {s.description && (
                    <span className="text-muted-foreground truncate ml-1.5">
                      · {s.description}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
