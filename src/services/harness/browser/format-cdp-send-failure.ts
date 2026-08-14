const CDP_ERROR_PATTERN = /^CDP error (-?\d+): (.*)$/

const hintForMethod = (method: string): string | undefined => {
  if (method === 'Runtime.evaluate') {
    return 'params.expression must be a JavaScript string, not a nested object'
  }
  if (method === 'Runtime.callFunctionOn') {
    return 'params.functionDeclaration must be a JavaScript string, not a nested object'
  }
  return undefined
}

const formatCdpSendFailure = (
  method: string,
  error: unknown,
): Record<string, unknown> => {
  const raw = error instanceof Error ? error.message : 'CDP request failed'
  const match = CDP_ERROR_PATTERN.exec(raw)
  const code = match ? Number(match[1]) : undefined
  const message = match ? match[2] : raw
  const hint = hintForMethod(method)
  return {
    error: 'cdp_failed',
    method,
    ...(code !== undefined ? { code } : {}),
    message,
    ...(hint ? { hint } : {}),
  }
}

export default formatCdpSendFailure
