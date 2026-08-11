import type { BrowserElementDetail } from '@/types/browser/browser-element-detail'

const tagFromXpath = (xpath: string): string | null => {
  const match = xpath.match(/\/([A-Za-z][\w:-]*)(?:\[\d+\])?$/)
  const tag = match?.[1]?.toLowerCase()
  return tag && tag.length > 0 ? tag : null
}

const tagFromAncestorPath = (ancestorPath: string): string | null => {
  const segments = ancestorPath
    .split(/[>\s/]+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
  const last = segments[segments.length - 1]
  if (!last) {
    return null
  }
  const match = last.match(/^([A-Za-z][\w:-]*)/)
  const tag = match?.[1]?.toLowerCase()
  return tag && tag.length > 0 ? tag : null
}

export default (detail: Pick<BrowserElementDetail, 'xpath' | 'ancestorPath'>): string => {
  const fromXpath = tagFromXpath(detail.xpath)
  if (fromXpath) {
    return fromXpath
  }
  if (detail.ancestorPath) {
    const fromAncestor = tagFromAncestorPath(detail.ancestorPath)
    if (fromAncestor) {
      return fromAncestor
    }
  }
  return 'element'
}
