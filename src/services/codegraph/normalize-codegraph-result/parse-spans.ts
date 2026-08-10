import type { CodebaseToolSpan } from '@/types/codegraph/codebase-tool-result'

const PATH_LINE_RE =
  /^(?<path>(?:[A-Za-z]:)?[^\s:*|]+?\.[A-Za-z0-9_.-]+):(?<line>\d+)\b/
const SEARCH_NAME_RE = /^\*\*(?<name>[^*]+)\*\*\s*\((?<kind>[^)]+)\)\s*$/
const FILE_SECTION_RE = /^\*\*`(?<path>[^`]+)`\*\*/
const LINE_NUMBERED_RE = /^(?<line>\d+)\t(?<body>.*)$/
const FILES_FLAT_RE =
  /^-\s+(?<path>(?:[A-Za-z]:)?[^\s:(]+(?:\.[A-Za-z0-9_.-]+)?|[^\s:(]+\/[^\s:(]+)\s*(?:\((?<meta>[^)]*)\))?$/
const NODE_SYMBOL_RE =
  /^-\s+`(?<name>[^`]+)`\s*\((?<kind>[^)]+)\)(?:[^\u2014-]*?)(?:\u2014|-)\s*:?(?<line>\d+)\s*$/
const NODE_FILE_HEADER_RE = /^\*\*(?<path>[^*]+?)\*\*/

export const parseFilesText = (text: string): CodebaseToolSpan[] => {
  const spans: CodebaseToolSpan[] = []
  for (const line of text.split(/\r?\n/)) {
    const match = line.trim().match(FILES_FLAT_RE)
    if (!match?.groups?.path) {
      continue
    }
    const path = match.groups.path.trim()
    if (path.length === 0 || path === 'Files') {
      continue
    }
    spans.push({
      path,
      startLine: 1,
      endLine: 1,
    })
  }
  return spans
}

export const parseNodeSymbolsText = (
  text: string,
  fallbackPath?: string,
): CodebaseToolSpan[] => {
  const spans: CodebaseToolSpan[] = []
  let currentPath = fallbackPath ?? null
  for (const line of text.split(/\r?\n/)) {
    const header = line.match(NODE_FILE_HEADER_RE)
    if (header?.groups?.path && !line.includes('`')) {
      const path = header.groups.path.trim()
      if (path.length > 0 && !/^Symbols$/i.test(path) && !path.includes(' \u2014 ')) {
        currentPath = path
      } else if (path.includes(' \u2014 ')) {
        currentPath = path.split(' \u2014 ')[0]?.trim() || currentPath
      }
    }
    const symbolMatch = line.trim().match(NODE_SYMBOL_RE)
    if (!symbolMatch?.groups?.name || !symbolMatch.groups.line) {
      continue
    }
    const path = currentPath
    if (!path) {
      continue
    }
    const startLine = Math.max(1, Number(symbolMatch.groups.line) || 1)
    spans.push({
      path,
      startLine,
      endLine: startLine,
      symbol: symbolMatch.groups.name.trim(),
    })
  }
  return spans
}

export const parseSearchText = (text: string): CodebaseToolSpan[] => {
  const lines = text.split(/\r?\n/)
  const spans: CodebaseToolSpan[] = []
  for (let index = 0; index < lines.length; index += 1) {
    const nameMatch = lines[index]?.match(SEARCH_NAME_RE)
    if (!nameMatch?.groups?.name) {
      continue
    }
    const next = lines[index + 1]?.trim() ?? ''
    const pathMatch = next.match(PATH_LINE_RE)
    if (!pathMatch?.groups?.path) {
      continue
    }
    const startLine = Math.max(1, Number(pathMatch.groups.line ?? '1') || 1)
    spans.push({
      path: pathMatch.groups.path,
      startLine,
      endLine: startLine,
      symbol: nameMatch.groups.name.trim(),
    })
  }
  return spans
}

export const parseExploreText = (text: string): CodebaseToolSpan[] => {
  const lines = text.split(/\r?\n/)
  const spans: CodebaseToolSpan[] = []
  let currentPath: string | null = null
  let lineNumbers: number[] = []
  let snippetLines: string[] = []

  const flush = (): void => {
    if (!currentPath) {
      return
    }
    if (lineNumbers.length === 0) {
      spans.push({
        path: currentPath,
        startLine: 1,
        endLine: 1,
        snippet: snippetLines.join('\n') || undefined,
      })
    } else {
      const startLine = Math.min(...lineNumbers)
      const endLine = Math.max(...lineNumbers)
      spans.push({
        path: currentPath,
        startLine,
        endLine,
        snippet: snippetLines.join('\n') || undefined,
      })
    }
    currentPath = null
    lineNumbers = []
    snippetLines = []
  }

  for (const line of lines) {
    const header = line.match(FILE_SECTION_RE)
    if (header?.groups?.path) {
      flush()
      currentPath = header.groups.path
      continue
    }
    if (!currentPath) {
      continue
    }
    const numbered = line.match(LINE_NUMBERED_RE)
    if (numbered?.groups?.line) {
      lineNumbers.push(Math.max(1, Number(numbered.groups.line) || 1))
      snippetLines.push(numbered.groups.body ?? '')
      continue
    }
    if (line.startsWith('```') || line.trim().length === 0) {
      continue
    }
    snippetLines.push(line)
  }
  flush()
  return spans
}

export { PATH_LINE_RE }
