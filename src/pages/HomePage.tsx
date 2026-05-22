import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { configApi, projectsApi, skillCardApi } from '@/api/client'
import { groupCardsBySkill } from '@/lib/cardGrouping'
import {
  ArrowRight,
  AlertTriangle,
} from 'lucide-react'

interface KpiState {
  sources: number | null
  projects: number | null
  cards: number | null
}

export default function HomePage() {
  const navigate = useNavigate()
  const [kpis, setKpis] = useState<KpiState>({ sources: null, projects: null, cards: null })

  // KPI fetch — fire-and-forget, fail individually so one outage doesn't
  // strand the whole hero. Display "—" for any field that errored.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [cfg, projs, cards] = await Promise.allSettled([
        configApi.get(),
        projectsApi.getAll(),
        skillCardApi.list(),
      ])
      if (cancelled) return
      // Cards KPI counts Skills (groups), not stored card files — same
      // semantics as the /cards page so the number matches what the user
      // sees there. Multiple versions of one Skill = one card on Home.
      const cardSummaries = cards.status === 'fulfilled' ? (cards.value?.cards ?? []) : null
      setKpis({
        sources: cfg.status === 'fulfilled' ? (cfg.value?.sourceDirs?.length ?? 0) : null,
        projects: projs.status === 'fulfilled' ? (projs.value?.projects?.length ?? 0) : null,
        cards: cardSummaries === null ? null : groupCardsBySkill(cardSummaries).length,
      })
    })()
    return () => { cancelled = true }
  }, [])

  const fmt = (n: number | null) => n === null ? '—' : String(n)

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-14">
      {/* Hero */}
      <section className="space-y-6">
        <h1 className="font-mono text-5xl md:text-6xl font-bold tracking-tighter leading-[0.95]">
          Skills.<br />
          Manager<span className="cursor-blink text-violet-600 dark:text-violet-400">_</span>
        </h1>
        <div className="space-y-1.5 max-w-xl">
          <p className="text-base md:text-lg text-foreground/80 leading-relaxed">
            一份 Skill,所有 AI 工具同时拿到。
          </p>
          <p className="font-mono text-xs text-muted-foreground tracking-wider uppercase">
            for Cursor &middot; Claude Code &middot; Windsurf &middot; Copilot
          </p>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Button
            size="default"
            onClick={() => navigate('/skills')}
            className="bg-foreground text-background hover:bg-foreground/90 gap-2 font-medium"
          >
            进入 Skills 库
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            size="default"
            variant="outline"
            onClick={() => navigate('/projects')}
            className="gap-2"
          >
            项目管理
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* KPIs */}
      <section className="space-y-3">
        <SectionLabel>STATUS</SectionLabel>
        <div className="grid grid-cols-3 gap-px bg-border rounded-md overflow-hidden">
          <Kpi value={fmt(kpis.sources)} label="源目录" />
          <Kpi value={fmt(kpis.projects)} label="项目" />
          <Kpi value={fmt(kpis.cards)} label="卡片" />
        </div>
      </section>

      {/* Workflow */}
      <section className="space-y-4">
        <SectionLabel>WORKFLOW</SectionLabel>
        <div className="flex items-stretch gap-0">
          <Step n="01" label="添加源目录" hint="Skills 库" />
          <Connector />
          <Step n="02" label="添加项目" hint="项目管理" />
          <Connector />
          <Step n="03" label="绑定" hint=".cursor/rules/" />
          <Connector />
          <Step n="04" label="重启 IDE" hint="" />
        </div>
      </section>

      {/* Notes */}
      <section className="space-y-3">
        <SectionLabel>NOTES</SectionLabel>
        <ul className="text-xs text-muted-foreground space-y-2 pl-1">
          <li className="flex items-start gap-2">
            <AlertTriangle className="h-3 w-3 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
            <span>悟空 Skills 必须经过审核,本产品不支持悟空。</span>
          </li>
          <li className="flex items-start gap-2">
            <AlertTriangle className="h-3 w-3 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
            <span>项目绑定 Skills 库后,原有 Skills 文件会移动到备份文件夹中。</span>
          </li>
        </ul>
      </section>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {children}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

function Kpi({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-background px-5 py-4 flex flex-col gap-1">
      <span className="font-mono text-3xl md:text-4xl font-semibold tracking-tight tabular-nums">
        {value}
      </span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  )
}

function Step({ n, label, hint }: { n: string; label: string; hint: string }) {
  return (
    <div className="flex-1 min-w-0 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground tracking-wider">{n}</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <p className="text-sm text-foreground font-medium truncate">{label}</p>
      {hint && <p className="font-mono text-[10px] text-muted-foreground truncate">{hint}</p>}
    </div>
  )
}

function Connector() {
  return (
    <div className="w-6 flex items-center justify-center text-muted-foreground/50 self-center pt-3">
      <span className="font-mono text-xs">→</span>
    </div>
  )
}
