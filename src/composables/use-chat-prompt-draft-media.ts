import { ref } from 'vue'
import type { BrowserElementSelection } from '@/types/browser/browser-element-selection'
import type { DraftBrowserElementMedia } from '@/types/chat/draft-browser-element-media'
import browserElementMediaLabel from '@/utils/browser-element-media-label'

const items = ref<DraftBrowserElementMedia[]>([])

const createPreviewUrl = (bytes: Uint8Array): string | null => {
  if (bytes.byteLength === 0) {
    return null
  }
  try {
    const copy = new Uint8Array(bytes)
    return URL.createObjectURL(new Blob([copy], { type: 'image/png' }))
  } catch {
    return null
  }
}

const revokePreviewUrl = (previewUrl: string | null): void => {
  if (!previewUrl) {
    return
  }
  URL.revokeObjectURL(previewUrl)
}

const append = (selection: BrowserElementSelection): DraftBrowserElementMedia => {
  const item: DraftBrowserElementMedia = {
    id: crypto.randomUUID(),
    selection,
    label: browserElementMediaLabel(selection.detail),
    previewUrl: createPreviewUrl(selection.screenshotBytes),
  }
  items.value = [...items.value, item]
  return item
}

const remove = (id: string): void => {
  const existing = items.value.find((item) => item.id === id)
  if (!existing) {
    return
  }
  revokePreviewUrl(existing.previewUrl)
  items.value = items.value.filter((item) => item.id !== id)
}

const clear = (): void => {
  for (const item of items.value) {
    revokePreviewUrl(item.previewUrl)
  }
  items.value = []
}

export default () => ({
  items,
  append,
  remove,
  clear,
})
