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

  it('indexes ask skill only in ask mode', () => {
    expect(listInternalSkillIndex('ask').some((skill) => skill.name === 'ask')).toBe(true)
    expect(listInternalSkillIndex('agent').some((skill) => skill.name === 'ask')).toBe(false)
  })

  it('indexes plan skill only in plan mode', () => {
    expect(listInternalSkillIndex('plan').some((skill) => skill.name === 'plan')).toBe(true)
    expect(listInternalSkillIndex('ask').some((skill) => skill.name === 'plan')).toBe(false)
  })

  it('indexes agent skill only in agent mode', () => {
    expect(listInternalSkillIndex('agent').some((skill) => skill.name === 'agent')).toBe(true)
    expect(listInternalSkillIndex('plan').some((skill) => skill.name === 'agent')).toBe(false)
  })

  it('loads studio skill content', () => {
    const loaded = loadInternalSkill('studio')
    expect(loaded).not.toBeNull()
    expect(loaded?.content).toContain('Studio artifacts')
  })

  it('loads ask skill content', () => {
    const loaded = loadInternalSkill('ask')
    expect(loaded).not.toBeNull()
    expect(loaded?.content).toContain('Ask mode')
  })
})
