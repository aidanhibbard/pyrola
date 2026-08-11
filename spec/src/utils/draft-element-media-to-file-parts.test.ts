import { describe, expect, it } from 'vitest'
import type { BrowserElementDetail } from '@/types/browser/browser-element-detail'
import type { DraftBrowserElementMedia } from '@/types/chat/draft-browser-element-media'
import draftElementMediaToFileParts from '@/utils/draft-element-media-to-file-parts'

const detail = (): BrowserElementDetail => ({
  xpath: '/html/body/div[1]',
  cssSelector: 'div.hero',
  role: null,
  name: null,
  attributes: { class: 'hero' },
  boundingBox: { x: 0, y: 0, width: 10, height: 10 },
  computedStyles: { display: 'block' },
  componentHint: null,
  screenshotPath: null,
  outerHTML: '<div class="hero">Hi</div>',
  innerText: 'Hi',
  pageUrl: 'https://example.com',
  ancestorPath: 'html > body > div',
  matchedCss: null,
})

const draftItem = (
  overrides?: Partial<DraftBrowserElementMedia>,
): DraftBrowserElementMedia => ({
  id: 'draft-1',
  label: 'div',
  previewUrl: null,
  selection: {
    detail: detail(),
    screenshotPath: '/tmp/shot.png',
    screenshotBytes: new Uint8Array([137, 80, 78, 71]),
  },
  ...overrides,
})

describe('draftElementMediaToFileParts', () => {
  it('always attaches JSON payload and includes screenshotPath', () => {
    const parts = draftElementMediaToFileParts([draftItem()], false)
    expect(parts).toHaveLength(1)
    const [jsonPart] = parts
    expect(jsonPart?.mediaType).toBe('application/json')
    expect(jsonPart?.filename).toBe('div.element.json')
    expect(jsonPart?.url.startsWith('data:application/json;base64,')).toBe(true)

    const payload = jsonPart!.url.slice('data:application/json;base64,'.length)
    const decoded = JSON.parse(atob(payload)) as BrowserElementDetail
    expect(decoded.screenshotPath).toBe('/tmp/shot.png')
    expect(decoded.outerHTML).toBe('<div class="hero">Hi</div>')
  })

  it('attaches PNG when vision is supported', () => {
    const parts = draftElementMediaToFileParts([draftItem()], true)
    expect(parts).toHaveLength(2)
    expect(parts[0]?.filename).toBe('div.element.json')
    expect(parts[1]?.mediaType).toBe('image/png')
    expect(parts[1]?.filename).toBe('div.png')
  })

  it('skips PNG when vision is not supported', () => {
    const parts = draftElementMediaToFileParts([draftItem()], false)
    expect(parts.every((part) => part.mediaType === 'application/json')).toBe(true)
  })

  it('skips empty screenshot bytes even when vision is supported', () => {
    const parts = draftElementMediaToFileParts(
      [
        draftItem({
          selection: {
            detail: detail(),
            screenshotPath: '/tmp/shot.png',
            screenshotBytes: new Uint8Array(),
          },
        }),
      ],
      true,
    )
    expect(parts).toHaveLength(1)
    expect(parts[0]?.mediaType).toBe('application/json')
  })
})
