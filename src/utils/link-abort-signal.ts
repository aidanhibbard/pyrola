export default (
  parent: AbortSignal | undefined,
  child: AbortController,
): void => {
  if (parent?.aborted) {
    child.abort()
    return
  }
  parent?.addEventListener('abort', () => child.abort(), { once: true })
}
