import { describe, expect, it } from 'vitest'
import parseStudioArtifact, {
  serializeStudioArtifact,
  updateStudioFrontmatter,
} from '@/services/studio/parse-studio-artifact'

describe('parseStudioArtifact', () => {
  it('parses frontmatter and body', () => {
    const parsed = parseStudioArtifact(`---
title: Launch Brief
status: draft
---

## Summary
`)
    expect(parsed.frontmatter.title).toBe('Launch Brief')
    expect(parsed.frontmatter.status).toBe('draft')
    expect(parsed.body).toContain('## Summary')
  })

  it('updates frontmatter while preserving body', () => {
    const original = serializeStudioArtifact({ title: 'Old', status: 'draft' }, 'Body')
    const next = updateStudioFrontmatter(original, { title: 'New', status: 'published' })
    const parsed = parseStudioArtifact(next)
    expect(parsed.frontmatter.title).toBe('New')
    expect(parsed.frontmatter.status).toBe('published')
    expect(parsed.body).toBe('Body')
  })
})
