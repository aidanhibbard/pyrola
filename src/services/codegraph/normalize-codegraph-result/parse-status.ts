import type { CodebaseStatusResult } from '@/types/codegraph/codebase-tool-result'
import { asRecord, extractText, toFiniteInt } from './helpers'

const STATUS_FIELD_RE = /^\*\*(?<label>[^*]+):\*\*\s*(?<value>.+?)\s*$/i
const PENDING_FILE_RE = /^-\s+(?<path>\S+)/

const parseStatusNumber = (value: string): number | undefined => {
  const match = value.replace(/,/g, '').match(/(\d+)/)
  if (!match?.[1]) {
    return undefined
  }
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : undefined
}

export const buildStatusDetail = (result: {
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

export default (raw: unknown): CodebaseStatusResult => {
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
