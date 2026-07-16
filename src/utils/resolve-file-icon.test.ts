import { describe, expect, it } from 'vitest'
import resolveFileIcon, { FILE_ICON_BASE } from '@/utils/resolve-file-icon'

describe('resolveFileIcon', () => {
  it('resolves vue, tsx, and jsx files distinctly', () => {
    expect(resolveFileIcon('App.vue').src).toBe(`${FILE_ICON_BASE}/vue.svg`)
    expect(resolveFileIcon('Button.tsx').icon).toBe('react_ts')
    expect(resolveFileIcon('Button.jsx').icon).toBe('react')
  })

  it('resolves java, c, and text files', () => {
    expect(resolveFileIcon('Main.java').src).toBe(`${FILE_ICON_BASE}/java.svg`)
    expect(resolveFileIcon('main.c').src).toBe(`${FILE_ICON_BASE}/c.svg`)
    expect(resolveFileIcon('readme.txt').icon).toBe('readme')
  })

  it('resolves well-known filenames', () => {
    expect(resolveFileIcon('package.json').icon).toBe('nodejs')
  })

  it('resolves folder icons for closed and open states', () => {
    const closed = resolveFileIcon('src', { isDirectory: true, isOpen: false })
    const open = resolveFileIcon('src', { isDirectory: true, isOpen: true })

    expect(closed.icon).toBe('folder-src')
    expect(open.icon).toBe('folder-src-open')
    expect(closed.src).not.toBe(open.src)
  })
})
