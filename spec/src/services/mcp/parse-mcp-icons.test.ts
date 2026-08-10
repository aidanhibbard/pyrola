import { describe, expect, it } from 'vitest'
import parseMcpIcons from '@/services/mcp/parse-mcp-icons'

describe('parseMcpIcons', () => {
  it('returns null for non-arrays and empty valid results', () => {
    expect(parseMcpIcons(null)).toBeNull()
    expect(parseMcpIcons({})).toBeNull()
    expect(parseMcpIcons([])).toBeNull()
    expect(parseMcpIcons([{ mimeType: 'image/png' }])).toBeNull()
    expect(parseMcpIcons([{ src: '' }])).toBeNull()
  })

  it('parses valid icons and optional fields', () => {
    expect(
      parseMcpIcons([
        null,
        'skip',
        { src: 'https://example.com/icon.png' },
        {
          src: 'https://example.com/dark.png',
          mimeType: 'image/png',
          sizes: ['16x16', 32, '32x32'],
          theme: 'dark',
        },
        { src: 'https://example.com/light.png', theme: 'light' },
        { src: 'https://example.com/bad-theme.png', theme: 'neon' },
      ]),
    ).toEqual([
      { src: 'https://example.com/icon.png' },
      {
        src: 'https://example.com/dark.png',
        mimeType: 'image/png',
        sizes: ['16x16', '32x32'],
        theme: 'dark',
      },
      { src: 'https://example.com/light.png', theme: 'light' },
      { src: 'https://example.com/bad-theme.png' },
    ])
  })
})
