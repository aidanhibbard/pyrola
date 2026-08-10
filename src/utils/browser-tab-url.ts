export const faviconForUrl = (url: string): string | null => {
  try {
    const host = new URL(url).hostname
    if (!host) {
      return null
    }
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`
  } catch {
    return null
  }
}

export const normalizeBrowserUrl = (raw: string): string => {
  const trimmed = raw.trim()
  if (!trimmed) {
    return trimmed
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return trimmed
  }
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`
  }
  // Domain-like tokens become https URLs; everything else is a web search.
  if (!/\s/.test(trimmed) && trimmed.includes('.')) {
    return `https://${trimmed}`
  }
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`
}

export const displayUrlForAddressBar = (url: string): string => {
  if (!url || url === 'about:blank') {
    return ''
  }
  return url
}
