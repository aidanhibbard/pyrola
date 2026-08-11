/**
 * Encode bytes as a data URL for FileUIPart.url (session messages need
 * durable data: URLs, not blob: URLs that can be revoked).
 */
export default (bytes: Uint8Array, mediaType: string): string => {
  const chunkSize = 0x8000
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return `data:${mediaType};base64,${btoa(binary)}`
}
