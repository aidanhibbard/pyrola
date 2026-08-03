import { describe, expect, it } from 'vitest'
import formatUnknownError from '@/utils/format-unknown-error'

describe('formatUnknownError', () => {
  it('returns Error message', () => {
    expect(formatUnknownError(new Error('boom'))).toBe('boom')
  })

  it('returns string errors from Tauri', () => {
    expect(formatUnknownError('missing activeContext field')).toBe(
      'missing activeContext field',
    )
  })

  it('reads message from plain objects', () => {
    expect(formatUnknownError({ message: 'proxy failed' })).toBe('proxy failed')
  })

  it('falls back for empty values', () => {
    expect(formatUnknownError(null)).toBe('Unknown error')
    expect(formatUnknownError({})).toBe('Unknown error')
  })
})
