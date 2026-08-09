import type {
  CodebaseImpactEdge,
  CodebaseImpactResult,
  CodebaseStatusResult,
  CodebaseToolResult,
  CodebaseToolSpan,
} from '@/types/codegraph/codebase-tool-result'

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

const toFiniteInt = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value)
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed)
    }
  }
  return null
}

const extractText = (raw: unknown): string => {
  if (typeof raw === 'string') {
    return raw
  }
  const record = asRecord(raw)
  if (!record) {
    return ''
  }
  if (typeof record.text === 'string') {
    return record.text
  }
  if (Array.isArray(record.content)) {
    return record.content
      .map((item) => {
        const block = asRecord(item)
        if (!block) {
          return ''
        }
        if (typeof block.text === 'string') {
          return block.text
        }
        return ''
      })
      .filter((part) => part.length > 0)
      .join('\n')
  }
  if ('result' in record) {
    return extractText(record.result)
  }
  return ''
}

const parseSpan = (value: unknown): CodebaseToolSpan | null => {
  const record = asRecord(value)
  if (!record) {
    return null
  }
  const path =
    typeof record.path === 'string'
      ? record.path
      : typeof record.filePath === 'string'
        ? record.filePath
        : typeof record.file === 'string'
          ? record.file
          : null
  if (!path || path.length === 0) {
    return null
  }
  const startLine =
    toFiniteInt(record.startLine) ??
    toFiniteInt(record.line) ??
    toFiniteInt(record.start) ??
    1
  const endLine =
    toFiniteInt(record.endLine) ??
    toFiniteInt(record.end) ??
    startLine
  const span: CodebaseToolSpan = {
    path,
    startLine: Math.max(1, startLine),
    endLine: Math.max(Math.max(1, startLine), endLine),
  }
  if (typeof record.symbol === 'string' && record.symbol.length > 0) {
    span.symbol = record.symbol
  } else if (typeof record.name === 'string' && record.name.length > 0) {
    span.symbol = record.name
  }
  if (typeof record.snippet === 'string' && record.snippet.length > 0) {
    span.snippet = record.snippet
  } else if (typeof record.code === 'string' && record.code.length > 0) {
    span.snippet = record.code
  }
  return span
}

const parseStructuredSpans = (raw: unknown): CodebaseToolSpan[] => {
  const record = asRecord(raw)
  const candidates: unknown[] = []
  if (Array.isArray(raw)) {
    candidates.push(...raw)
  }
  if (record) {
    for (const key of ['results', 'nodes', 'symbols', 'items', 'matches'] as const) {
      const value = record[key]
      if (Array.isArray(value)) {
        candidates.push(...value)
      }
    }
  }
  const spans: CodebaseToolSpan[] = []
  for (const item of candidates) {
    const span = parseSpan(item)
    if (span) {
      spans.push(span)
    }
  }
  return spans
}

const PATH_LINE_RE =
  /^(?<path>(?:[A-Za-z]:)?[^\s:*|]+?\.[A-Za-z0-9_.-]+):(?<line>\d+)\b/
const SEARCH_NAME_RE = /^\*\*(?<name>[^*]+)\*\*\s*\((?<kind>[^)]+)\)\s*$/
const FILE_SECTION_RE = /^\*\*`(?<path>[^`]+)`\*\*/
const IMPACT_FILE_RE = /^\*\*(?<path>[^*]+?):\*\*\s*$/
const IMPACT_SYMBOL_RE = /(?<name>[A-Za-z_$][\w$]*)\s*:\s*(?<line>\d+)/g
const LINE_NUMBERED_RE = /^(?<line>\d+)\t(?<body>.*)$/
const PENDING_FILE_RE = /^-\s+(?<path>\S+)/
const FILES_FLAT_RE =
  /^-\s+(?<path>(?:[A-Za-z]:)?[^\s:(]+(?:\.[A-Za-z0-9_.-]+)?|[^\s:(]+\/[^\s:(]+)\s*(?:\((?<meta>[^)]*)\))?$/
const NODE_SYMBOL_RE =
  /^-\s+`(?<name>[^`]+)`\s*\((?<kind>[^)]+)\)(?:[^\u2014\-]*?)(?:\u2014|-)\s*:?(?<line>\d+)\s*$/
const NODE_FILE_HEADER_RE = /^\*\*(?<path>[^*]+?)\*\*/
const EDGE_RE =
  /(?<from>[A-Za-z_$][\w$.:]*)\s*(?:->|→)\s*(?<to>[A-Za-z_$][\w$.:]*)(?:\s*\((?<kind>[^)]+)\))?/

const parseFilesText = (text: string): CodebaseToolSpan[] => {
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

const parseNodeSymbolsText = (text: string, fallbackPath?: string): CodebaseToolSpan[] => {
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

const parseSearchText = (text: string): CodebaseToolSpan[] => {
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

const parseExploreText = (text: string): CodebaseToolSpan[] => {
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

const parseImpactText = (
  text: string,
): { results: CodebaseToolSpan[]; edges: CodebaseImpactEdge[] } => {
  const lines = text.split(/\r?\n/)
  const results: CodebaseToolSpan[] = []
  const edges: CodebaseImpactEdge[] = []
  let currentFile: string | null = null

  for (const line of lines) {
    const fileMatch = line.match(IMPACT_FILE_RE)
    if (fileMatch?.groups?.path) {
      currentFile = fileMatch.groups.path.trim()
      continue
    }
    if (line.includes('->') || line.includes('\u2192')) {
      EDGE_RE.lastIndex = 0
      const edgeMatch = EDGE_RE.exec(line)
      if (edgeMatch?.groups?.from && edgeMatch.groups.to) {
        edges.push({
          from: edgeMatch.groups.from,
          to: edgeMatch.groups.to,
          kind: edgeMatch.groups.kind,
        })
      }
    }
    if (!currentFile) {
      const pathMatch = line.trim().match(PATH_LINE_RE)
      if (pathMatch?.groups?.path) {
        const startLine = Math.max(1, Number(pathMatch.groups.line ?? '1') || 1)
        results.push({
          path: pathMatch.groups.path,
          startLine,
          endLine: startLine,
        })
      }
      continue
    }
    IMPACT_SYMBOL_RE.lastIndex = 0
    let symbolMatch: RegExpExecArray | null = IMPACT_SYMBOL_RE.exec(line)
    while (symbolMatch?.groups?.name && symbolMatch.groups.line) {
      const startLine = Math.max(1, Number(symbolMatch.groups.line) || 1)
      results.push({
        path: currentFile,
        startLine,
        endLine: startLine,
        symbol: symbolMatch.groups.name,
      })
      symbolMatch = IMPACT_SYMBOL_RE.exec(line)
    }
  }

  return { results, edges }
}

const STATUS_FIELD_RE = /^\*\*(?<label>[^*]+):\*\*\s*(?<value>.+?)\s*$/i

const parseStatusNumber = (value: string): number | undefined => {
  const match = value.replace(/,/g, '').match(/(\d+)/)
  if (!match?.[1]) {
    return undefined
  }
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : undefined
}

const buildStatusDetail = (result: {
  filesIndexed?: number
  totalNodes?: number
  totalEdges?: number
  languages?: string[]
}): string | undefined => {
  const parts: string[] = []
  if (typeof result.filesIndexed === 'number') {
    parts.push(`${result.filesIndexed} files`)
  }
  if (typeof result.totalNodes === 'number') {
    parts.push(`${result.totalNodes} nodes`)
  }
  if (typeof result.totalEdges === 'number') {
    parts.push(`${result.totalEdges} edges`)
  }
  if (result.languages && result.languages.length > 0) {
    parts.push(result.languages.join(', '))
  }
  return parts.length > 0 ? parts.join(', ') : undefined
}

const parseStatusText = (text: string): CodebaseStatusResult => {
  const lower = text.toLowerCase()
  const pendingFiles: string[] = []
  let inPending = false
  let inLanguages = false
  const languages: string[] = []
  let filesIndexed: number | undefined
  let totalNodes: number | undefined
  let totalEdges: number | undefined
  let databaseSize: string | undefined
  let backend: string | undefined

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (/^\*\*Pending sync:\*\*/i.test(trimmed)) {
      inPending = true
      inLanguages = false
      continue
    }
    if (/^\*\*Languages\*\*/i.test(trimmed) || /^\*\*Languages:\*\*/i.test(trimmed)) {
      inLanguages = true
      inPending = false
      continue
    }
    if (/^\*\*Nodes by Kind\*\*/i.test(trimmed)) {
      inLanguages = false
      inPending = false
      continue
    }
    if (inPending) {
      if (line.startsWith('**') || trimmed.length === 0) {
        if (line.startsWith('**')) {
          inPending = false
        }
        continue
      }
      const pendingMatch = line.match(PENDING_FILE_RE)
      if (pendingMatch?.groups?.path) {
        pendingFiles.push(pendingMatch.groups.path)
      }
      continue
    }
    if (inLanguages) {
      if (line.startsWith('**') || trimmed.length === 0) {
        if (line.startsWith('**')) {
          inLanguages = false
        }
        continue
      }
      const lang = trimmed.replace(/^[-*]\s*/, '').split(':')[0]?.trim()
      if (lang) {
        languages.push(lang)
      }
      continue
    }

    const field = trimmed.match(STATUS_FIELD_RE)
    if (!field?.groups?.label || field.groups.value === undefined) {
      continue
    }
    const label = field.groups.label.trim().toLowerCase()
    const value = field.groups.value.trim()
    if (label === 'files indexed') {
      filesIndexed = parseStatusNumber(value)
    } else if (label === 'total nodes') {
      totalNodes = parseStatusNumber(value)
    } else if (label === 'total edges') {
      totalEdges = parseStatusNumber(value)
    } else if (label === 'database size') {
      databaseSize = value
    } else if (label === 'backend') {
      backend = value
    }
  }

  const indexing = pendingFiles.length > 0 && /indexing in progress/i.test(text)
  const syncing = pendingFiles.length > 0 || /pending sync/i.test(lower)
  const degraded =
    /auto-sync disabled/i.test(lower) ||
    (/watcher/i.test(lower) && /degraded|stopped|frozen/i.test(lower))
  const noIndex =
    /no files indexed/i.test(lower) ||
    /not indexed/i.test(lower) ||
    /no \.codegraph/i.test(lower)
  const ready =
    !noIndex && !degraded && (filesIndexed === undefined || filesIndexed > 0)

  const result: CodebaseStatusResult = {
    ready,
    indexing,
    syncing,
    filesIndexed,
    totalNodes,
    totalEdges,
    databaseSize,
    backend,
    languages: languages.length > 0 ? languages : undefined,
  }
  result.detail = buildStatusDetail(result)
  if (pendingFiles.length > 0) {
    result.pendingFiles = pendingFiles
  }
  if (degraded || noIndex) {
    result.error = degraded
      ? 'Graph auto-sync is disabled or degraded'
      : 'Graph index is missing or empty'
  }
  return result
}

const fallbackToolResult = (text: string): CodebaseToolResult => ({
  summary: text.trim().length > 0 ? text.trim() : 'No structured CodeGraph results',
  results: [],
})

const normalizeToolResult = (raw: unknown): CodebaseToolResult => {
  const structured = parseStructuredSpans(raw)
  if (structured.length > 0) {
    const text = extractText(raw).trim()
    return {
      summary: text.length > 0 ? text : undefined,
      results: structured,
    }
  }

  const text = extractText(raw)
  if (text.length === 0) {
    return fallbackToolResult('')
  }

  const exploreSpans = parseExploreText(text)
  if (exploreSpans.length > 0) {
    return { summary: text, results: exploreSpans }
  }

  const searchSpans = parseSearchText(text)
  if (searchSpans.length > 0) {
    return { summary: text, results: searchSpans }
  }

  const fileSpans = parseFilesText(text)
  if (fileSpans.length > 0) {
    return { summary: text, results: fileSpans }
  }

  const nodeSpans = parseNodeSymbolsText(text)
  if (nodeSpans.length > 0) {
    return { summary: text, results: nodeSpans }
  }

  return fallbackToolResult(text)
}

const normalizeFilesResult = (raw: unknown): CodebaseToolResult => {
  const structured = parseStructuredSpans(raw)
  if (structured.length > 0) {
    const text = extractText(raw).trim()
    return {
      summary: text.length > 0 ? text : undefined,
      results: structured,
    }
  }
  const text = extractText(raw)
  if (text.length === 0) {
    return fallbackToolResult('')
  }
  const fileSpans = parseFilesText(text)
  if (fileSpans.length > 0) {
    return { summary: text, results: fileSpans }
  }
  return fallbackToolResult(text)
}

const normalizeNodeResult = (
  raw: unknown,
  fallbackPath?: string,
): CodebaseToolResult => {
  const structured = parseStructuredSpans(raw)
  if (structured.length > 0) {
    const text = extractText(raw).trim()
    return {
      summary: text.length > 0 ? text : undefined,
      results: structured,
    }
  }
  const text = extractText(raw)
  if (text.length === 0) {
    return fallbackToolResult('')
  }
  const nodeSpans = parseNodeSymbolsText(text, fallbackPath)
  if (nodeSpans.length > 0) {
    return { summary: text, results: nodeSpans }
  }
  const exploreSpans = parseExploreText(text)
  if (exploreSpans.length > 0) {
    return { summary: text, results: exploreSpans }
  }
  return fallbackToolResult(text)
}

const normalizeImpactResult = (raw: unknown): CodebaseImpactResult => {
  const structured = parseStructuredSpans(raw)
  const text = extractText(raw)
  if (structured.length > 0) {
    return {
      summary: text.trim().length > 0 ? text.trim() : undefined,
      results: structured,
    }
  }
  if (text.length === 0) {
    return { summary: 'No structured CodeGraph impact results', results: [] }
  }
  const parsed = parseImpactText(text)
  return {
    summary: text,
    results: parsed.results,
    edges: parsed.edges.length > 0 ? parsed.edges : undefined,
  }
}

const normalizeStatusResult = (raw: unknown): CodebaseStatusResult => {
  const record = asRecord(raw)
  if (record) {
    const ready =
      typeof record.ready === 'boolean'
        ? record.ready
        : typeof record.ok === 'boolean'
          ? record.ok
          : null
    if (ready !== null) {
      const pending = Array.isArray(record.pendingFiles)
        ? record.pendingFiles.filter((item): item is string => typeof item === 'string')
        : undefined
      const languages = Array.isArray(record.languages)
        ? record.languages.filter((item): item is string => typeof item === 'string')
        : undefined
      const result: CodebaseStatusResult = {
        ready,
        indexing: Boolean(record.indexing),
        syncing: Boolean(record.syncing),
        error: typeof record.error === 'string' ? record.error : undefined,
        filesIndexed: toFiniteInt(record.filesIndexed) ?? undefined,
        totalNodes: toFiniteInt(record.totalNodes) ?? undefined,
        totalEdges: toFiniteInt(record.totalEdges) ?? undefined,
        databaseSize:
          typeof record.databaseSize === 'string' ? record.databaseSize : undefined,
        backend: typeof record.backend === 'string' ? record.backend : undefined,
        languages: languages && languages.length > 0 ? languages : undefined,
        pendingFiles: pending && pending.length > 0 ? pending : undefined,
      }
      result.detail =
        typeof record.detail === 'string' && !record.detail.includes('**')
          ? record.detail
          : buildStatusDetail(result)
      return result
    }
  }

  const text = extractText(raw)
  if (text.length === 0) {
    return {
      ready: false,
      indexing: false,
      syncing: false,
      error: 'Empty Graph status response',
    }
  }
  return parseStatusText(text)
}

const normalizeCodegraphResult = {
  tool: normalizeToolResult,
  files: normalizeFilesResult,
  node: normalizeNodeResult,
  impact: normalizeImpactResult,
  status: normalizeStatusResult,
}

export default normalizeCodegraphResult
