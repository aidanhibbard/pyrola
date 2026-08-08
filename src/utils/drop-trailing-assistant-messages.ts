import type { UIMessage } from 'ai'

/** Drop trailing assistant turns so resume can append the patched spawn turn once. */
export default (messages: UIMessage[]): UIMessage[] => {
  const next = [...messages]
  while (next.length > 0 && next.at(-1)?.role === 'assistant') {
    next.pop()
  }
  return next
}
