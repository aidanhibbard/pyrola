/** True when the body starts like an HTML document (`<html` in first 100 chars). */
const looksLikeHtml = (body: string): boolean => {
  return body.slice(0, 100).toLowerCase().includes('<html')
}

export default looksLikeHtml
