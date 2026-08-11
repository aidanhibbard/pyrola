import type { FileUIPart } from 'ai'
import type { DraftBrowserElementMedia } from '@/types/chat/draft-browser-element-media'
import bytesToDataUrl from '@/utils/bytes-to-data-url'

/**
 * Map draft browser-element media into FileUIParts for submit.
 * Always attaches the Copilot JSON payload; attaches cropped PNG only when
 * the selected model supports vision.
 */
export default (
  items: DraftBrowserElementMedia[],
  supportsVision: boolean,
): FileUIPart[] => {
  const parts: FileUIPart[] = []

  for (const item of items) {
    const detail = {
      ...item.selection.detail,
      screenshotPath: item.selection.screenshotPath,
    }
    const jsonBytes = new TextEncoder().encode(JSON.stringify(detail))
    parts.push({
      type: 'file',
      mediaType: 'application/json',
      filename: `${item.label}.element.json`,
      url: bytesToDataUrl(jsonBytes, 'application/json'),
    })

    if (!supportsVision) {
      continue
    }

    const screenshotBytes = item.selection.screenshotBytes
    if (screenshotBytes.byteLength === 0) {
      continue
    }

    const pngBytes = new Uint8Array(screenshotBytes)
    parts.push({
      type: 'file',
      mediaType: 'image/png',
      filename: `${item.label}.png`,
      url: bytesToDataUrl(pngBytes, 'image/png'),
    })
  }

  return parts
}
