type HighlightSegment = {
  text: string
  matched: boolean
}

const collapseFlags = (text: string, matched: boolean[]): HighlightSegment[] => {
  const segments: HighlightSegment[] = []
  for (let index = 0; index < text.length; index += 1) {
    const isMatched = matched[index] === true
    const char = text[index] ?? ''
    const last = segments[segments.length - 1]
    if (last && last.matched === isMatched) {
      last.text += char
      continue
    }
    segments.push({ text: char, matched: isMatched })
  }
  return segments
}

export default (text: string, query: string): HighlightSegment[] => {
  const needle = query.trim().toLowerCase()
  if (!text) {
    return []
  }
  if (!needle) {
    return [{ text, matched: false }]
  }

  const lower = text.toLowerCase()
  const contiguousIndex = lower.indexOf(needle)
  if (contiguousIndex >= 0) {
    const flags = Array.from({ length: text.length }, () => false)
    for (let index = contiguousIndex; index < contiguousIndex + needle.length; index += 1) {
      flags[index] = true
    }
    return collapseFlags(text, flags)
  }

  const flags = Array.from({ length: text.length }, () => false)
  let queryIndex = 0
  for (let index = 0; index < text.length && queryIndex < needle.length; index += 1) {
    if (lower[index] === needle[queryIndex]) {
      flags[index] = true
      queryIndex += 1
    }
  }

  if (queryIndex < needle.length) {
    return [{ text, matched: false }]
  }

  return collapseFlags(text, flags)
}
