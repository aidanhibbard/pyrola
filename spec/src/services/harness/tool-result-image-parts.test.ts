import { describe, expect, it } from 'vitest'
import { stripImageParts } from '@/services/harness/tool-result-image-parts'

describe('stripImageParts', () => {
  it('returns primitives and arrays unchanged', () => {
    expect(stripImageParts(null)).toBeNull()
    expect(stripImageParts(undefined)).toBeUndefined()
    expect(stripImageParts('ok')).toBe('ok')
    expect(stripImageParts(42)).toBe(42)
    expect(stripImageParts([1, 2])).toEqual([1, 2])
  })

  it('removes imageParts from objects and leaves other fields', () => {
    expect(
      stripImageParts({
        summary: 'done',
        imageParts: [{ data: 'abc' }],
        path: 'a.png',
      }),
    ).toEqual({ summary: 'done', path: 'a.png' })
  })

  it('returns a shallow copy when imageParts is absent', () => {
    const input = { summary: 'done' }
    const result = stripImageParts(input)
    expect(result).toEqual({ summary: 'done' })
    expect(result).not.toBe(input)
  })
})
