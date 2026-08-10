import { describe, expect, it } from 'vitest'
import shouldFlushBackgroundSubagentResume from '@/utils/should-flush-background-subagent-resume'

describe('shouldFlushBackgroundSubagentResume', () => {
  it('resumes when pending, idle parent, no runners, and deliverables exist', () => {
    expect(
      shouldFlushBackgroundSubagentResume({
        parentBusy: false,
        hasPending: true,
        hasRunning: false,
        deliverableCount: 2,
      }),
    ).toBe('resume')
  })

  it('waits while the parent is busy', () => {
    expect(
      shouldFlushBackgroundSubagentResume({
        parentBusy: true,
        hasPending: true,
        hasRunning: false,
        deliverableCount: 1,
      }),
    ).toBe('noop')
  })

  it('waits while siblings are still running', () => {
    expect(
      shouldFlushBackgroundSubagentResume({
        parentBusy: false,
        hasPending: true,
        hasRunning: true,
        deliverableCount: 1,
      }),
    ).toBe('noop')
  })

  it('clears when pending but nothing deliverable remains', () => {
    expect(
      shouldFlushBackgroundSubagentResume({
        parentBusy: false,
        hasPending: true,
        hasRunning: false,
        deliverableCount: 0,
      }),
    ).toBe('clear')
  })

  it('is a noop without a pending background turn', () => {
    expect(
      shouldFlushBackgroundSubagentResume({
        parentBusy: false,
        hasPending: false,
        hasRunning: false,
        deliverableCount: 1,
      }),
    ).toBe('noop')
  })
})
