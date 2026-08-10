const LSP_DIAGNOSTICS_METHODS = new Set([
  'diagnostics',
  'publishDiagnostics',
  'textDocument/diagnostic',
])

const parseLspDiagnosticItems = (result: unknown): unknown[] => {
  if (Array.isArray(result)) {
    return result
  }
  if (!result || typeof result !== 'object') {
    return []
  }
  const payload = result as Record<string, unknown>
  if (Array.isArray(payload.items)) {
    return payload.items
  }
  if (Array.isArray(payload.diagnostics)) {
    return payload.diagnostics
  }
  return []
}

export { LSP_DIAGNOSTICS_METHODS, parseLspDiagnosticItems }
