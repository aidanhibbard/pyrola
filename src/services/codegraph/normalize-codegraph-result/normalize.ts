import type {
  CodebaseImpactResult,
  CodebaseToolResult,
} from '@/types/codegraph/codebase-tool-result'
import { extractText, parseStructuredSpans } from './helpers'
import {
  parseExploreText,
  parseFilesText,
  parseNodeSymbolsText,
  parseSearchText,
} from './parse-spans'
import parseImpactText from './parse-impact'
import normalizeStatusResult from './parse-status'

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

export default {
  tool: normalizeToolResult,
  files: normalizeFilesResult,
  node: normalizeNodeResult,
  impact: normalizeImpactResult,
  status: normalizeStatusResult,
}
