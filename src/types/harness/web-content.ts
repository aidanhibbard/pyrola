export type WebFetchFormat = 'markdown' | 'text' | 'html'

export type WebContentKind = 'markdown' | 'text' | 'html' | 'passthrough'

export type ConvertWebContentInput = {
  body: string
  contentType: string
  format: WebFetchFormat
}

export type ConvertWebContentOk = {
  ok: true
  text: string
  kind: WebContentKind
  spaShell: boolean
  challenge: boolean
}

export type ConvertWebContentErr = {
  ok: false
  error: string
}

export type ConvertWebContentResult = ConvertWebContentOk | ConvertWebContentErr

export type TruncateWebTextInput = {
  text: string
  maxLength: number
  startIndex?: number
}

export type TruncateWebTextResult = {
  text: string
  truncated: boolean
  nextStartIndex?: number
}

export type ParsedContentType = {
  type: string
  subtype: string
  /** type/subtype without parameters (RFC 9110 media type). */
  mediaType: string
}
