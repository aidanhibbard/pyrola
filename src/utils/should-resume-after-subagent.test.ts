import { describe, expect, it } from 'vitest'
import shouldResumeAfterSubagent from '@/utils/should-resume-after-subagent'

describe('shouldResumeAfterSubagent', () => {
  it('resumes non-blocking completed results', () => {
    expect(
      shouldResumeAfterSubagent({ blocking: false, outcome: 'completed' }),
    ).toBe(true)
  })

  it('resumes non-blocking failed results', () => {
    expect(
      shouldResumeAfterSubagent({ blocking: false, outcome: 'failed' }),
    ).toBe(true)
  })

  it('does not resume aborted results', () => {
    expect(
      shouldResumeAfterSubagent({ blocking: false, outcome: 'aborted' }),
    ).toBe(false)
  })

  it('does not resume blocking results', () => {
    expect(
      shouldResumeAfterSubagent({ blocking: true, outcome: 'completed' }),
    ).toBe(false)
  })
})
