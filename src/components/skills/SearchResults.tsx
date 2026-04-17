import { File } from 'lucide-react'

interface SearchResult {
  path: string
  matches: { line: number; text: string }[]
}

interface SearchResultsProps {
  results: SearchResult[]
  onSelectFile: (path: string) => void
}

export default function SearchResults({ results, onSelectFile }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        没有找到匹配的结果
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {results.map((result) => {
        const fileName = result.path.split('/').pop() || result.path
        return (
          <div key={result.path} className="rounded-md border">
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-accent rounded-t-md"
              onClick={() => onSelectFile(result.path)}
            >
              <File className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{fileName}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {result.matches.length} 处匹配
              </span>
            </button>
            <div className="border-t px-3 py-1">
              {result.matches.slice(0, 5).map((match, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 py-1 text-xs"
                >
                  <span className="shrink-0 text-muted-foreground w-8 text-right">
                    {match.line}
                  </span>
                  <span className="truncate font-mono">{match.text}</span>
                </div>
              ))}
              {result.matches.length > 5 && (
                <p className="py-1 text-xs text-muted-foreground">
                  ...还有 {result.matches.length - 5} 处匹配
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
