import { describe, expect, it } from 'vitest'
import parseStudioArtifact from '@/services/studio/parse-studio-artifact'

describe('parseStudioArtifact', () => {
  it('parses frontmatter and body', () => {
    const parsed = parseStudioArtifact(`---
title: Launch Brief
status: draft
---

## Summary
`)
    expect(parsed.frontmatter?.title).toBe('Launch Brief')
    expect(parsed.frontmatter?.status).toBe('draft')
    expect(parsed.body).toContain('## Summary')
  })

  it('returns parseError for invalid frontmatter', () => {
    const parsed = parseStudioArtifact(`---
status: published
---

Body
`)
    expect(parsed.parseError).toMatch(/title is required/)
    expect(parsed.frontmatter).toBeNull()
  })
})
