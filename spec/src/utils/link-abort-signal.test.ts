import { describe, expect, it } from 'vitest'
import linkAbortSignal from '@/utils/link-abort-signal'

describe('linkAbortSignal', () => {
  it('aborts the child immediately when the parent is already aborted', () => {
    const parent = new AbortController()
    parent.abort()
    const child = new AbortController()

    linkAbortSignal(parent.signal, child)

    expect(child.signal.aborted).toBe(true)
  })

  it('aborts the child when the parent aborts later', () => {
    const parent = new AbortController()
    const child = new AbortController()

    linkAbortSignal(parent.signal, child)
    expect(child.signal.aborted).toBe(false)

    parent.abort()
    expect(child.signal.aborted).toBe(true)
  })

  it('leaves the child running when there is no parent signal', () => {
    const child = new AbortController()
    linkAbortSignal(undefined, child)
    expect(child.signal.aborted).toBe(false)
  })
})
