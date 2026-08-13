/** Media types that must not be converted into agent context text. */
const isBinaryContentType = (mediaType: string): boolean => {
  if (mediaType === 'application/pdf' || mediaType === 'application/octet-stream') {
    return true
  }
  return mediaType.startsWith('image/')
}

export default isBinaryContentType
