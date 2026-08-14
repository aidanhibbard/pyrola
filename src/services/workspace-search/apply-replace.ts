import type {
  SearchReplaceLocation,
  SearchReplaceOptions,
  SearchReplaceResult,
} from '@/types/workbench/search-replace-options'

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildFindPattern = (
  find: string,
  options: SearchReplaceOptions,
  global: boolean,
): RegExp => {
  const source = options.regex ? find : escapeRegExp(find)
  const wrapped = options.wholeWord ? `\\b(?:${source})\\b` : source
  let flags = global ? 'g' : ''
  if (!options.matchCase) {
    flags += 'i'
  }
  return new RegExp(wrapped, flags)
}

const splitLines = (content: string): string[] => content.split('\n')

const joinLines = (lines: string[]): string => lines.join('\n')

const replaceInContent = (
  content: string,
  find: string,
  replace: string,
  options: SearchReplaceOptions,
): SearchReplaceResult => {
  if (!find) {
    return { content, count: 0 }
  }

  let pattern: RegExp
  try {
    pattern = buildFindPattern(find, options, true)
  } catch {
    return { content, count: 0 }
  }

  let count = 0
  const next = content.replace(pattern, (...args: string[]) => {
    count += 1
    if (!options.regex) {
      return replace
    }
    const match = args[0] ?? ''
    const offsetIndex = args.length - 2
    const groups = args.slice(1, offsetIndex)
    return expandRegexReplacement(replace, match, groups)
  })

  return { content: next, count }
}

const expandRegexReplacement = (
  template: string,
  match: string,
  groups: string[],
): string => {
  return template.replace(/\$(\d+|\$|&)/g, (token, key: string) => {
    if (key === '$') {
      return '$'
    }
    if (key === '&') {
      return match
    }
    const index = Number(key)
    if (!Number.isFinite(index) || index < 1) {
      return token
    }
    return groups[index - 1] ?? ''
  })
}

const applyReplaceAt = (
  content: string,
  find: string,
  replace: string,
  options: SearchReplaceOptions,
  location: SearchReplaceLocation,
): SearchReplaceResult => {
  if (!find || location.lineNumber < 1) {
    return { content, count: 0 }
  }

  const lines = splitLines(content)
  const lineIndex = location.lineNumber - 1
  if (lineIndex >= lines.length) {
    return { content, count: 0 }
  }

  const line = lines[lineIndex] ?? ''
  const hasColumns =
    typeof location.startColumn === 'number'
    && typeof location.endColumn === 'number'
    && location.startColumn >= 1
    && location.endColumn > location.startColumn

  if (hasColumns) {
    const start = location.startColumn! - 1
    const end = location.endColumn! - 1
    if (end > line.length) {
      return { content, count: 0 }
    }
    const matchedText = line.slice(start, end)
    let pattern: RegExp
    try {
      pattern = buildFindPattern(find, options, false)
    } catch {
      return { content, count: 0 }
    }
    pattern.lastIndex = 0
    const match = pattern.exec(matchedText)
    if (!match || match.index !== 0 || match[0] !== matchedText) {
      return { content, count: 0 }
    }
    const replacement = options.regex
      ? expandRegexReplacement(replace, match[0], match.slice(1))
      : replace
    lines[lineIndex] = `${line.slice(0, start)}${replacement}${line.slice(end)}`
    return { content: joinLines(lines), count: 1 }
  }

  let pattern: RegExp
  try {
    pattern = buildFindPattern(find, options, false)
  } catch {
    return { content, count: 0 }
  }
  pattern.lastIndex = 0
  const match = pattern.exec(line)
  if (!match || match.index == null) {
    return { content, count: 0 }
  }
  const start = match.index
  const end = start + match[0].length
  const replacement = options.regex
    ? expandRegexReplacement(replace, match[0], match.slice(1))
    : replace
  lines[lineIndex] = `${line.slice(0, start)}${replacement}${line.slice(end)}`
  return { content: joinLines(lines), count: 1 }
}

export { applyReplaceAt, buildFindPattern }
export default replaceInContent
