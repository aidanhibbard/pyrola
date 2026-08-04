import { stripImageParts } from '@/services/harness/tool-result-image-parts'

const MAX_TOOL_RESULT_CHARS = 20_000
const TRUNCATION_MARKER = '\n\n[Result truncated — content exceeded limit]'

export default (result: unknown): unknown => {
  if (typeof result === 'string') {
    if (result.length <= MAX_TOOL_RESULT_CHARS) {
      return result
    }
    return result.slice(0, MAX_TOOL_RESULT_CHARS) + TRUNCATION_MARKER
  }

  if (!result || typeof result !== 'object') {
    return result
  }

  // Strip imageParts before truncation/persistence — paths stay on sibling fields;
  // base64 never belongs in messages.jsonl.
  const record = stripImageParts(result) as Record<string, unknown>
  const patched: Record<string, unknown> = {}
  let changed = record !== result

  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'string' && value.length > MAX_TOOL_RESULT_CHARS) {
      patched[key] = value.slice(0, MAX_TOOL_RESULT_CHARS) + TRUNCATION_MARKER
      changed = true
    } else {
      patched[key] = value
    }
  }

  return changed ? patched : result
}
