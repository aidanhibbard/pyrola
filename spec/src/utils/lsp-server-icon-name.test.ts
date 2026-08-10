import { describe, expect, it } from 'vitest'
import lspServerIconName from '@/utils/lsp-server-icon-name'
import resolveFileIcon, { FILE_ICON_BASE } from '@/utils/resolve-file-icon'

describe('lspServerIconName', () => {
  it('maps known servers to representative filenames', () => {
    expect(lspServerIconName('vue', ['.vue'])).toBe('App.vue')
    expect(lspServerIconName('typescript', ['.ts'])).toBe('index.ts')
    expect(lspServerIconName('gopls', ['.go'])).toBe('main.go')
    expect(lspServerIconName('dockerfile', [])).toBe('Dockerfile')
  })

  it('falls back to the first extension', () => {
    expect(lspServerIconName('custom', ['.zig'])).toBe('file.zig')
    expect(lspServerIconName('custom', ['rs'])).toBe('file.rs')
    expect(lspServerIconName('custom', [])).toBe('file.txt')
  })

  it('resolves through the same file icon pipeline as the editor', () => {
    expect(resolveFileIcon(lspServerIconName('vue', ['.vue']))?.src).toBe(
      `${FILE_ICON_BASE}/vue.svg`,
    )
    expect(resolveFileIcon(lspServerIconName('java', ['.java']))?.src).toBe(
      `${FILE_ICON_BASE}/java.svg`,
    )
  })
})
