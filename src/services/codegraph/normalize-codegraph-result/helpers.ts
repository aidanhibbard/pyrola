import type { CodebaseToolSpan } from '@/types/codegraph/codebase-tool-result'

export const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

export const toFiniteInt = (value: unknown): number | null => {
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

export const extractText = (raw: unknown): string => {
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

export const parseSpan = (value: unknown): CodebaseToolSpan | null => {
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

export const parseStructuredSpans = (raw: unknown): CodebaseToolSpan[] => {
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
