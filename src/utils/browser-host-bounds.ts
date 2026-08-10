import type { CefBounds } from '@/types/browser/cef-bounds'

const readBrowserHostBounds = (hostEl: HTMLElement | null): CefBounds | null => {
  if (!hostEl) {
    return null
  }
  const rect = hostEl.getBoundingClientRect()
  if (rect.width < 1 || rect.height < 1) {
    return null
  }
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  }
}

export default readBrowserHostBounds
