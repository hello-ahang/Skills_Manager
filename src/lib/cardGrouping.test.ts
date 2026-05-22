import { describe, it, expect } from 'vitest'
import { groupCardsBySkill } from './cardGrouping'
import type { SkillCardSummary } from '@/api/client'

function mk(partial: Partial<SkillCardSummary> & { id: string; skillPath: string; generatedAt: string }): SkillCardSummary {
  return {
    skillName: partial.skillName ?? 'skill',
    title: partial.title ?? 'title',
    aiUsed: partial.aiUsed ?? false,
    hasRubric: partial.hasRubric ?? false,
    ...partial,
  }
}

describe('groupCardsBySkill', () => {
  it('returns empty array for empty input', () => {
    expect(groupCardsBySkill([])).toEqual([])
  })

  it('groups single card into single group', () => {
    const c = mk({ id: 'a', skillPath: '/x/foo', generatedAt: '2026-05-22T10:00:00Z' })
    const groups = groupCardsBySkill([c])
    expect(groups).toHaveLength(1)
    expect(groups[0].skillPath).toBe('/x/foo')
    expect(groups[0].versions).toHaveLength(1)
    expect(groups[0].latest.id).toBe('a')
  })

  it('groups multiple cards by skillPath', () => {
    const cards = [
      mk({ id: 'a1', skillPath: '/x/foo', generatedAt: '2026-05-22T10:00:00Z' }),
      mk({ id: 'a2', skillPath: '/x/foo', generatedAt: '2026-05-22T11:00:00Z' }),
      mk({ id: 'b1', skillPath: '/x/bar', generatedAt: '2026-05-22T09:00:00Z' }),
    ]
    const groups = groupCardsBySkill(cards)
    expect(groups).toHaveLength(2)
    const fooGroup = groups.find(g => g.skillPath === '/x/foo')!
    expect(fooGroup.versions.map(v => v.id)).toEqual(['a2', 'a1'])
    expect(fooGroup.latest.id).toBe('a2')
  })

  it('sorts versions inside group by generatedAt DESC', () => {
    const cards = [
      mk({ id: 'old', skillPath: '/x/foo', generatedAt: '2026-05-22T08:00:00Z' }),
      mk({ id: 'new', skillPath: '/x/foo', generatedAt: '2026-05-22T17:00:00Z' }),
      mk({ id: 'mid', skillPath: '/x/foo', generatedAt: '2026-05-22T12:00:00Z' }),
    ]
    const [group] = groupCardsBySkill(cards)
    expect(group.versions.map(v => v.id)).toEqual(['new', 'mid', 'old'])
    expect(group.latest.id).toBe('new')
  })

  it('sorts groups by their latest generatedAt DESC', () => {
    const cards = [
      mk({ id: 'foo-old', skillPath: '/x/foo', generatedAt: '2026-05-22T08:00:00Z' }),
      mk({ id: 'bar-new', skillPath: '/x/bar', generatedAt: '2026-05-22T17:00:00Z' }),
      mk({ id: 'baz-mid', skillPath: '/x/baz', generatedAt: '2026-05-22T12:00:00Z' }),
    ]
    const groups = groupCardsBySkill(cards)
    expect(groups.map(g => g.skillPath)).toEqual(['/x/bar', '/x/baz', '/x/foo'])
  })

  it('uses latest skillName as group display name (handles rename mid-history)', () => {
    const cards = [
      mk({ id: 'old', skillPath: '/x/foo', skillName: 'OldName', generatedAt: '2026-05-22T08:00:00Z' }),
      mk({ id: 'new', skillPath: '/x/foo', skillName: 'NewName', generatedAt: '2026-05-22T17:00:00Z' }),
    ]
    const [group] = groupCardsBySkill(cards)
    expect(group.skillName).toBe('NewName')
  })

  it('preserves aiUsed and hasRubric on each version (no flattening)', () => {
    const cards = [
      mk({ id: 'a', skillPath: '/x/foo', generatedAt: '2026-05-22T08:00:00Z', aiUsed: false, hasRubric: false }),
      mk({ id: 'b', skillPath: '/x/foo', generatedAt: '2026-05-22T17:00:00Z', aiUsed: true, hasRubric: true }),
    ]
    const [group] = groupCardsBySkill(cards)
    expect(group.versions.find(v => v.id === 'a')!.aiUsed).toBe(false)
    expect(group.versions.find(v => v.id === 'b')!.aiUsed).toBe(true)
    expect(group.latest.aiUsed).toBe(true)
  })

  it('treats two skills with same display name but different paths as separate groups', () => {
    const cards = [
      mk({ id: 'a', skillPath: '/private/foo', skillName: 'foo', generatedAt: '2026-05-22T10:00:00Z' }),
      mk({ id: 'b', skillPath: '/share/foo', skillName: 'foo', generatedAt: '2026-05-22T11:00:00Z' }),
    ]
    const groups = groupCardsBySkill(cards)
    expect(groups).toHaveLength(2)
    expect(new Set(groups.map(g => g.skillPath))).toEqual(new Set(['/private/foo', '/share/foo']))
  })
})
