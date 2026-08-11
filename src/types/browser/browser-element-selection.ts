import type { BrowserElementDetail } from './browser-element-detail'

export type BrowserElementSelection = {
  detail: BrowserElementDetail
  screenshotPath: string
  screenshotBytes: Uint8Array
}
