import { toast } from 'vue-sonner'
import { browserCefSetPassthroughRects } from '@/services/pyrola/pyrola-tauri/browser'
import type { CefBounds } from '@/types/browser/cef-bounds'
import readBrowserHostBounds from '@/utils/browser-host-bounds'

type SyncBrowserPassthroughRectsArgs = {
  enabled: boolean
  hostEl: HTMLElement | null
  lastBounds: CefBounds | null
}

const syncBrowserPassthroughRects = async (
  args: SyncBrowserPassthroughRectsArgs,
): Promise<void> => {
  const bounds = args.enabled
    ? (readBrowserHostBounds(args.hostEl) ?? args.lastBounds)
    : null
  const rects = bounds ? [bounds] : []
  try {
    await browserCefSetPassthroughRects(rects)
  } catch (error) {
    toast.error('Failed to update browser click targets', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

export default syncBrowserPassthroughRects
