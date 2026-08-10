import type {
  CodebaseImpactEdge,
  CodebaseToolSpan,
} from '@/types/codegraph/codebase-tool-result'
import { PATH_LINE_RE } from './parse-spans'

const IMPACT_FILE_RE = /^\*\*(?<path>[^*]+?):\*\*\s*$/
const IMPACT_SYMBOL_RE = /(?<name>[A-Za-z_$][\w$]*)\s*:\s*(?<line>\d+)/g
const EDGE_RE =
  /(?<from>[A-Za-z_$][\w$.:]*)\s*(?:->|→)\s*(?<to>[A-Za-z_$][\w$.:]*)(?:\s*\((?<kind>[^)]+)\))?/

export default (
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
