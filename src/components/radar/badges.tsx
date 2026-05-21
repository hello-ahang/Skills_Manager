import { Award, FolderOpen, History, Library } from 'lucide-react'

export const GRADE_COLORS: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  B: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  C: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  D: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  F: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export function SourceBadge({ source, sourceName }: { source: string; sourceName: string }) {
  const config: Record<string, { icon: typeof Library; color: string }> = {
    library: { icon: Library, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    project: { icon: FolderOpen, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    'import-history': { icon: History, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  }
  const { icon: Icon, color } = config[source] || config.library
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {sourceName}
    </span>
  )
}

export function TagBadge({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
      {tag}
    </span>
  )
}

export function GradeBadge({ grade, score }: { grade: string; score?: number }) {
  const color = GRADE_COLORS[grade] || GRADE_COLORS.F
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}
      title={score != null ? `Rubric 质量分: ${score}` : `质量等级: ${grade}`}
    >
      <Award className="h-3 w-3" />
      {grade}
    </span>
  )
}
