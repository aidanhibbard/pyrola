/**
 * Decode a FileUIPart url (data: or blob:) to UTF-8 text for non-vision
 * model message conversion. Returns null when decode fails.
 */
export default async (url: string): Promise<string | null> => {
  if (url.startsWith('data:')) {
    const comma = url.indexOf(',')
    if (comma < 0) {
      return null
    }
    const meta = url.slice(5, comma)
    const payload = url.slice(comma + 1)
    try {
      if (meta.includes(';base64')) {
        const binary = atob(payload)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i)
        }
        return new TextDecoder().decode(bytes)
      }
      return decodeURIComponent(payload)
    } catch {
      return null
    }
  }

  if (url.startsWith('blob:')) {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        return null
      }
      return await response.text()
    } catch {
      return null
    }
  }

  return null
}
