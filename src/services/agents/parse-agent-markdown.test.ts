import { describe, expect, it } from 'vitest'
import parseAgentMarkdown from '@/services/agents/parse-agent-markdown'

describe('parseAgentMarkdown', () => {
  it('parses model and reasoning from frontmatter', () => {
    const parsed = parseAgentMarkdown(`---
name: explorer
description: Read-only exploration
model: anthropic::claude-sonnet-4-5
reasoning: medium
---

Body instructions here.
`)
    expect(parsed.frontmatter.name).toBe('explorer')
    expect(parsed.frontmatter.description).toBe('Read-only exploration')
    expect(parsed.frontmatter.model).toBe('anthropic::claude-sonnet-4-5')
    expect(parsed.frontmatter.reasoning).toBe('medium')
    expect(parsed.body).toContain('Body instructions')
  })

  it('drops invalid reasoning values', () => {
    const parsed = parseAgentMarkdown(`---
reasoning: turbo
---

Body
`)
    expect(parsed.frontmatter.reasoning).toBeUndefined()
    expect(parsed.body).toBe('Body')
  })
})
