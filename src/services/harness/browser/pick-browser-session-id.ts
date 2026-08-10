/** Prefer session_id; viewId is the legacy alias (both are CEF session ids). */
const pickBrowserSessionId = (input: {
  session_id?: string
  viewId?: string
}): string | undefined => {
  const preferred = input.session_id?.trim()
  if (preferred) {
    return preferred
  }
  const legacy = input.viewId?.trim()
  return legacy || undefined
}

export default pickBrowserSessionId
