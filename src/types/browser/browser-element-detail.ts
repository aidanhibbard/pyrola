export type BrowserElementDetail = {
  xpath: string
  cssSelector: string | null
  role: string | null
  name: string | null
  attributes: Record<string, string>
  boundingBox: { x: number; y: number; width: number; height: number } | null
  computedStyles: Record<string, string>
  componentHint: string | null
  screenshotPath: string | null
}
