const PENDING_RESPONSE_FORMAT_MESSAGE =
  'Invalid error response format: Gateway request failed'

const USAGE_EVENT_NOT_FOUND = 'Usage event not found'
const NO_USAGE_EVENT_FOUND = 'No usage event found'

const readErrorMessage = (error: unknown): string | undefined => {
  if (error instanceof Error && typeof error.message === 'string') {
    return error.message
  }
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message
  }
  return undefined
}

const readErrorResponse = (error: unknown): unknown => {
  if (!error || typeof error !== 'object' || !('response' in error)) {
    return undefined
  }
  return (error as { response: unknown }).response
}

const responseIndicatesUsagePending = (response: unknown): boolean => {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    return false
  }
  const data = response as Record<string, unknown>
  if (data.error === USAGE_EVENT_NOT_FOUND) {
    return true
  }
  if (
    data.error &&
    typeof data.error === 'object' &&
    !Array.isArray(data.error)
  ) {
    const nested = data.error as Record<string, unknown>
    if (
      nested.message === USAGE_EVENT_NOT_FOUND ||
      (typeof nested.message === 'string' &&
        nested.message.includes(NO_USAGE_EVENT_FOUND))
    ) {
      return true
    }
  }
  if (
    typeof data.message === 'string' &&
    data.message.includes(NO_USAGE_EVENT_FOUND)
  ) {
    return true
  }
  return false
}

/**
 * True when getGenerationInfo failed because the usage event is not ready yet
 * (race after stream finish) rather than a hard gateway/client error.
 */
export default (error: unknown): boolean => {
  const message = readErrorMessage(error)
  if (message === PENDING_RESPONSE_FORMAT_MESSAGE) {
    return true
  }
  if (message !== undefined && message.includes(NO_USAGE_EVENT_FOUND)) {
    return true
  }
  if (message === USAGE_EVENT_NOT_FOUND) {
    return true
  }

  const name =
    error && typeof error === 'object' && 'name' in error
      ? (error as { name: unknown }).name
      : undefined
  if (name === 'GatewayResponseError') {
    if (responseIndicatesUsagePending(readErrorResponse(error))) {
      return true
    }
    // Unparseable not-found bodies often surface as GatewayResponseError with
    // the fixed invalid-format message (already handled above).
  }

  return responseIndicatesUsagePending(readErrorResponse(error))
}
