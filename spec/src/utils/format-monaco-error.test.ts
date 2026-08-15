import { describe, expect, it } from 'vitest'
import formatMonacoError from '@/utils/format-monaco-error'

describe('formatMonacoError', () => {
  it('returns a short line for Chromium CSP hash dumps', () => {
    const hashes = Array.from({ length: 40 }, (_, index) => `'sha256-${index}'`).join(' ')
    const message = `Refused to compile or instantiate WebAssembly module because 'wasm-unsafe-eval' is not an allowed source of script in the following Content Security Policy directive: "script-src 'self' ${hashes}"`
    expect(formatMonacoError(new Error(message))).toBe(
      'Editor highlighting could not load (CSP blocked WebAssembly).',
    )
  })

  it('caps long non-CSP descriptions', () => {
    const message = 'x'.repeat(250)
    const formatted = formatMonacoError(message)
    expect(formatted.length).toBe(200)
    expect(formatted.endsWith('...')).toBe(true)
  })

  it('passes through short messages', () => {
    expect(formatMonacoError(new Error('Failed to read file'))).toBe(
      'Failed to read file',
    )
  })
})
