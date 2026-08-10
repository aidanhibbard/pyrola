import { describe, expect, it } from 'vitest'
import isStudioHtmlContent from '@/services/studio/is-studio-html-content'

describe('isStudioHtmlContent', () => {
  it('detects HTML documents', () => {
    expect(isStudioHtmlContent('<!DOCTYPE html><html><body>Hi</body></html>')).toBe(true)
    expect(isStudioHtmlContent('<html><body>Hi</body></html>')).toBe(true)
  })

  it('detects script tags', () => {
    expect(isStudioHtmlContent('# Title\n\n<script>alert(1)</script>')).toBe(true)
  })

  it('allows Comark markdown', () => {
    const content = `---
title: Brief
---

## Summary

::metrics
---
items:
  - label: A
    value: "1"
---
::
`
    expect(isStudioHtmlContent(content)).toBe(false)
  })
})
