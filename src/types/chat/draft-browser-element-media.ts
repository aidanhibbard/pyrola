import type { BrowserElementSelection } from '@/types/browser/browser-element-selection'

export type DraftBrowserElementMedia = {
  id: string
  selection: BrowserElementSelection
  label: string
  previewUrl: string | null
}
