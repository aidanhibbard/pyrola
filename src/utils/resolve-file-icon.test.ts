import { describe, expect, it } from 'vitest'
import { getIconForFilePath } from 'vscode-material-icons'
import resolveFileIcon, { FILE_ICON_BASE } from '@/utils/resolve-file-icon'

describe('resolveFileIcon', () => {
  it('resolves vue, tsx, and jsx files distinctly', () => {
    expect(resolveFileIcon('App.vue')?.src).toBe(`${FILE_ICON_BASE}/vue.svg`)
    expect(resolveFileIcon('Button.tsx')?.src).toBe(
      `${FILE_ICON_BASE}/${getIconForFilePath('Button.tsx')}.svg`,
    )
    expect(resolveFileIcon('Button.jsx')?.src).toBe(
      `${FILE_ICON_BASE}/${getIconForFilePath('Button.jsx')}.svg`,
    )
  })

  it('resolves java, c, and text files', () => {
    expect(resolveFileIcon('Main.java')?.src).toBe(`${FILE_ICON_BASE}/java.svg`)
    expect(resolveFileIcon('main.c')?.src).toBe(`${FILE_ICON_BASE}/c.svg`)
    expect(resolveFileIcon('readme.txt')?.src).toBe(
      `${FILE_ICON_BASE}/${getIconForFilePath('readme.txt')}.svg`,
    )
  })

  it('resolves well-known filenames', () => {
    expect(resolveFileIcon('package.json')?.src).toBe(
      `${FILE_ICON_BASE}/${getIconForFilePath('package.json')}.svg`,
    )
  })

  it('returns null for directories', () => {
    expect(resolveFileIcon('src', { isDirectory: true, isOpen: false })).toBeNull()
    expect(resolveFileIcon('src', { isDirectory: true, isOpen: true })).toBeNull()
  })
})
