import type * as monaco from 'monaco-editor'
import {
  isRecord,
  readRange,
  type LspDiagnostic,
  type LspRange,
} from './types'

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
