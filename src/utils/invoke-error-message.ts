/** Normalize Tauri invoke / unknown catch values into a user-facing message. */
export default (error: unknown): string => {
  if (typeof error === 'string' && error.trim().length > 0) {
    return error
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message: unknown }).message
    if (typeof message === 'string' && message.trim().length > 0) {
      return message
    }
  }
  return 'Unknown error'
}
