import { describe, expect, it } from 'vitest'
import { listInternalSkillIndex, loadInternalSkill } from '@/services/skills/discover-internal-skills'

describe('discover-internal-skills', () => {
  it('indexes the studio skill in studio mode', () => {
    const index = listInternalSkillIndex('studio')
    expect(index.some((skill) => skill.name === 'studio')).toBe(true)
  })

  it('hides studio skill outside studio mode', () => {
    const index = listInternalSkillIndex('agent')
    expect(index.some((skill) => skill.name === 'studio')).toBe(false)
  })

  it('loads studio skill content', () => {
    const loaded = loadInternalSkill('studio')
    expect(loaded).not.toBeNull()
    expect(loaded?.content).toContain('Studio artifacts')
  })
})
