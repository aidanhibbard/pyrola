import { describe, expect, it } from 'vitest'
import { detectMonacoLanguage } from '@/utils/monaco-language'

describe('detectMonacoLanguage', () => {
  it('maps common web and systems extensions', () => {
    expect(detectMonacoLanguage('src/App.vue')).toBe('vue')
    expect(detectMonacoLanguage('pages/index.astro')).toBe('astro')
    expect(detectMonacoLanguage('lib/main.rs')).toBe('rust')
    expect(detectMonacoLanguage('src/main.zig')).toBe('zig')
    expect(detectMonacoLanguage('src/foo.c')).toBe('c')
    expect(detectMonacoLanguage('src/foo.cpp')).toBe('cpp')
    expect(detectMonacoLanguage('src/Main.java')).toBe('java')
    expect(detectMonacoLanguage('src/app.tsx')).toBe('tsx')
    expect(detectMonacoLanguage('styles/app.scss')).toBe('scss')
  })

  it('maps basename-only files', () => {
    expect(detectMonacoLanguage('Dockerfile')).toBe('dockerfile')
    expect(detectMonacoLanguage('path/to/Makefile')).toBe('make')
  })

  it('falls back to plaintext', () => {
    expect(detectMonacoLanguage('notes.unknownext')).toBe('plaintext')
    expect(detectMonacoLanguage('LICENSE')).toBe('plaintext')
  })
})
