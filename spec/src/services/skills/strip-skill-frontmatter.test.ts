import { describe, expect, it } from 'vitest'
import parseSkillFrontmatter, {
  MAX_SKILL_CONTENT_CHARS,
} from '@/services/skills/strip-skill-frontmatter'

describe('strip-skill-frontmatter', () => {
  it('extracts frontmatter and body', () => {
    const { frontmatter, body } = parseSkillFrontmatter(`---
name: studio
description: Studio publishing guide
---

# Heading
`)
    expect(frontmatter.name).toBe('studio')
    expect(frontmatter.description).toBe('Studio publishing guide')
    expect(body).toContain('# Heading')
  })

  it('exports a skill content cap', () => {
    expect(MAX_SKILL_CONTENT_CHARS).toBeGreaterThan(1000)
  })
})
