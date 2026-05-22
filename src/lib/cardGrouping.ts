import type { SkillCardSummary } from '@/api/client'

export interface SkillCardGroup {
  skillPath: string
  skillName: string
  versions: SkillCardSummary[]
  latest: SkillCardSummary
}

/**
 * Group flat card summaries by skillPath. Each group's `versions` is sorted
 * by generatedAt DESC; `latest` is the head. The cards storage layer caps at
 * 5 versions per skill — this function makes no assumption about that, it
 * just groups whatever the server returned.
 *
 * skillPath is the grouping key (not skillName) because two different
 * sourceDirs could in theory have skills with the same display name.
 */
export function groupCardsBySkill(cards: SkillCardSummary[]): SkillCardGroup[] {
  const buckets = new Map<string, SkillCardSummary[]>()
  for (const card of cards) {
    const arr = buckets.get(card.skillPath)
    if (arr) arr.push(card)
    else buckets.set(card.skillPath, [card])
  }

  const groups: SkillCardGroup[] = []
  for (const [skillPath, versions] of buckets) {
    versions.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
    const latest = versions[0]
    groups.push({
      skillPath,
      skillName: latest.skillName,
      versions,
      latest,
    })
  }

  // Stable group order: latest's generatedAt DESC, so the most recently
  // touched skill floats to the top.
  groups.sort((a, b) => b.latest.generatedAt.localeCompare(a.latest.generatedAt))
  return groups
}
