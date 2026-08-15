import { describe, expect, it } from 'vitest'
import withToolExamples from '@/services/harness/with-tool-examples'

describe('withToolExamples', () => {
  it('keeps a single short example', () => {
    const rendered = withToolExamples('Click by ref.', [
      { ref: 'e12' },
      { ref: 'e12', doubleClick: true, button: 'left' },
    ])
    expect(rendered).toContain('"ref": "e12"')
    expect(rendered).not.toContain('doubleClick')
    expect(rendered.match(/^\d+\. /gm)?.length).toBe(1)
  })

  it('returns the description when there are no examples', () => {
    expect(withToolExamples('Click by ref.', [])).toBe('Click by ref.')
  })
})
