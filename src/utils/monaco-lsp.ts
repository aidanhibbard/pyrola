import type * as monaco from 'monaco-editor'

export const LSP_MARKER_OWNER = 'pyrola-lsp'

type LspPosition = {
  line: number
  character: number
}

type LspRange = {
  start: LspPosition
  end: LspPosition
}

export type LspDiagnostic = {
  range?: LspRange
  severity?: number
  code?: string | number
  source?: string
  message: string
}

type LspMarkedString = string | { language?: string; value: string }

type LspMarkupContent = {
  kind: 'plaintext' | 'markdown'
  value: string
}

type LspCompletionItem = {
  label: string
  kind?: number
  detail?: string
  documentation?: string | LspMarkupContent
  insertText?: string
  sortText?: string
  filterText?: string
  textEdit?: {
    range: LspRange
    newText: string
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const readPosition = (value: unknown): LspPosition | null => {
  if (!isRecord(value)) {
    return null
  }
  const line = value.line
  const character = value.character
  if (typeof line !== 'number' || typeof character !== 'number') {
    return null
  }
  return { line, character }
}

const readRange = (value: unknown): LspRange | null => {
  if (!isRecord(value)) {
    return null
  }
  const start = readPosition(value.start)
  const end = readPosition(value.end)
  if (!start || !end) {
    return null
  }
  return { start, end }
}

export const fileExtension = (path: string): string => path.split('.').pop() ?? ''

export const workspacePathToFileUri = (projectRoot: string, path: string): string => {
  const root = projectRoot.replace(/\\/g, '/').replace(/\/$/, '')
  const relative = path.replace(/^\//, '')
  let absolute = `${root}/${relative}`
  if (!absolute.startsWith('/')) {
    absolute = `/${absolute}`
  }
  return `file://${absolute}`
}

export const normalizeFileUri = (uri: string): string => {
  try {
    return decodeURIComponent(new URL(uri).pathname)
  } catch {
    return decodeURIComponent(uri.replace(/^file:\/\//, ''))
  }
}

export const parseLspDiagnostics = (result: unknown): LspDiagnostic[] => {
  if (!isRecord(result)) {
    return Array.isArray(result) ? parseLspDiagnostics({ items: result }) : []
  }

  if (Array.isArray(result.diagnostics)) {
    return result.diagnostics
      .map((item) => parseDiagnosticItem(item))
      .filter((item): item is LspDiagnostic => item !== null)
  }

  if (Array.isArray(result.items)) {
    return result.items
      .map((item) => parseDiagnosticItem(item))
      .filter((item): item is LspDiagnostic => item !== null)
  }

  if (result.kind === 'full' && Array.isArray(result.items)) {
    return result.items
      .map((item) => parseDiagnosticItem(item))
      .filter((item): item is LspDiagnostic => item !== null)
  }

  return []
}

const parseDiagnosticItem = (value: unknown): LspDiagnostic | null => {
  if (!isRecord(value) || typeof value.message !== 'string') {
    return null
  }

  return {
    range: readRange(value.range) ?? undefined,
    severity: typeof value.severity === 'number' ? value.severity : undefined,
    code:
      typeof value.code === 'string' || typeof value.code === 'number'
        ? value.code
        : undefined,
    source: typeof value.source === 'string' ? value.source : undefined,
    message: value.message,
  }
}

export const lspSeverityToMonaco = (
  severity: number | undefined,
  monacoApi: typeof monaco,
): monaco.MarkerSeverity => {
  switch (severity) {
    case 1:
      return monacoApi.MarkerSeverity.Error
    case 2:
      return monacoApi.MarkerSeverity.Warning
    case 3:
      return monacoApi.MarkerSeverity.Info
    case 4:
      return monacoApi.MarkerSeverity.Hint
    default:
      return monacoApi.MarkerSeverity.Info
  }
}

export const lspRangeToMonaco = (
  range: LspRange | undefined,
  monacoApi: typeof monaco,
  fallbackLine: number,
): monaco.IRange => {
  if (!range) {
    return new monacoApi.Range(fallbackLine, 1, fallbackLine, 1)
  }

  return {
    startLineNumber: range.start.line + 1,
    startColumn: range.start.character + 1,
    endLineNumber: range.end.line + 1,
    endColumn: range.end.character + 1,
  }
}

export const lspDiagnosticsToMarkers = (
  diagnostics: LspDiagnostic[],
  monacoApi: typeof monaco,
): monaco.editor.IMarkerData[] =>
  diagnostics
    .filter((diagnostic) => diagnostic.severity === 1 || diagnostic.severity === 2)
    .map((diagnostic) => {
      const line = diagnostic.range?.start.line ?? 0
      return {
        severity: lspSeverityToMonaco(diagnostic.severity, monacoApi),
        message: diagnostic.message,
        source: diagnostic.source,
        code: diagnostic.code?.toString(),
        ...lspRangeToMonaco(diagnostic.range, monacoApi, line + 1),
      }
    })

const readMarkedString = (value: LspMarkedString): string => {
  if (typeof value === 'string') {
    return value
  }
  return value.value
}

const readMarkupContent = (value: unknown): string | null => {
  if (!isRecord(value) || typeof value.value !== 'string') {
    return null
  }
  return value.value
}

export const parseLspHoverContents = (result: unknown): string[] => {
  if (!isRecord(result)) {
    return []
  }

  const { contents } = result
  if (typeof contents === 'string') {
    return [contents]
  }

  const markup = readMarkupContent(contents)
  if (markup) {
    return [markup]
  }

  if (Array.isArray(contents)) {
    return contents
      .map((item) => {
        if (typeof item === 'string') {
          return item
        }
        if (isRecord(item) && typeof item.value === 'string') {
          return item.value
        }
        return null
      })
      .filter((item): item is string => item !== null)
  }

  if (isRecord(contents) && typeof contents.value === 'string') {
    return [readMarkedString(contents as LspMarkedString)]
  }

  return []
}

const lspCompletionKindToMonaco = (
  kind: number | undefined,
  monacoApi: typeof monaco,
): monaco.languages.CompletionItemKind => {
  const kinds = monacoApi.languages.CompletionItemKind
  switch (kind) {
    case 3:
      return kinds.Function
    case 4:
      return kinds.Constructor
    case 5:
      return kinds.Field
    case 6:
      return kinds.Variable
    case 7:
      return kinds.Class
    case 8:
      return kinds.Interface
    case 9:
      return kinds.Module
    case 10:
      return kinds.Property
    case 12:
      return kinds.Value
    case 13:
      return kinds.Enum
    case 14:
      return kinds.Keyword
    case 15:
      return kinds.Snippet
    case 17:
      return kinds.Constant
    case 21:
      return kinds.TypeParameter
    default:
      return kinds.Text
  }
}

const parseCompletionItem = (
  value: unknown,
  monacoApi: typeof monaco,
): monaco.languages.CompletionItem | null => {
  if (!isRecord(value) || typeof value.label !== 'string') {
    return null
  }

  const item = value as LspCompletionItem
  const suggestion = {
    label: item.label,
    kind: lspCompletionKindToMonaco(item.kind, monacoApi),
    detail: item.detail,
    insertText: item.insertText ?? item.label,
    sortText: item.sortText,
    filterText: item.filterText,
  } as monaco.languages.CompletionItem

  if (typeof item.documentation === 'string') {
    suggestion.documentation = item.documentation
  } else {
    const docs = readMarkupContent(item.documentation)
    if (docs) {
      suggestion.documentation = docs
    }
  }

  if (item.textEdit) {
    const range = readRange(item.textEdit.range)
    if (range) {
      suggestion.range = lspRangeToMonaco(range, monacoApi, range.start.line + 1)
      suggestion.insertText = item.textEdit.newText
    }
  }

  return suggestion
}

export const parseLspCompletionItems = (
  result: unknown,
  monacoApi: typeof monaco,
): monaco.languages.CompletionItem[] => {
  if (!isRecord(result)) {
    return []
  }

  const items = Array.isArray(result) ? result : result.items
  if (!Array.isArray(items)) {
    return []
  }

  return items
    .map((item) => parseCompletionItem(item, monacoApi))
    .filter((item): item is monaco.languages.CompletionItem => item !== null)
}
