export const isAllowedMcpUrl = (rawUrl: string): boolean => {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return false
  }

  if (url.protocol === 'https:') {
    return true
  }

  if (url.protocol !== 'http:') {
    return false
  }

  const host = url.hostname.toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1'
}
