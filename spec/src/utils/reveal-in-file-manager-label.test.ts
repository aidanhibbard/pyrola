import { describe, expect, it } from 'vitest'
import revealInFileManagerLabel from '@/utils/reveal-in-file-manager-label'

describe('reveal-in-file-manager-label', () => {
  it('uses Finder on macOS', () => {
    expect(revealInFileManagerLabel('MacIntel')).toBe('Reveal in Finder')
    expect(revealInFileManagerLabel('MacARM')).toBe('Reveal in Finder')
  })

  it('uses Explorer on Windows', () => {
    expect(revealInFileManagerLabel('Win32')).toBe('Reveal in Explorer')
  })

  it('uses file manager on other platforms', () => {
    expect(revealInFileManagerLabel('Linux x86_64')).toBe('Reveal in file manager')
  })
})
