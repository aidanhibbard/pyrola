const MAX_CAUSE_DEPTH = 8

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  return value as Record<string, unknown>
}

const issuePath = (issue: Record<string, unknown>): string => {
  if (!Array.isArray(issue.path)) {
    return ''
  }
  return issue.path.map((segment) => String(segment)).join('.')
}

const formatIssue = (issue: unknown): string => {
  const record = asRecord(issue)
  if (!record) {
    return String(issue)
  }
  const lines: string[] = []
  const path = issuePath(record)
  if (path) {
    lines.push(`path: ${path}`)
  }
  if (record.expected !== undefined) {
    lines.push(`expected: ${String(record.expected)}`)
  }
  if (record.received !== undefined) {
    lines.push(`received: ${String(record.received)}`)
  }
  if (typeof record.message === 'string' && record.message.length > 0) {
    lines.push(record.message)
  }
  return lines.join('\n')
}

const collectIssues = (error: unknown, depth = 0): unknown[] => {
  if (depth > MAX_CAUSE_DEPTH) {
    return []
  }
  const record = asRecord(error)
  if (!record) {
    return []
  }
  if (Array.isArray(record.issues) && record.issues.length > 0) {
    return record.issues
  }
  if ('cause' in record) {
    return collectIssues(record.cause, depth + 1)
  }
  return []
}

const readToolName = (error: unknown): string | undefined => {
  const record = asRecord(error)
  if (typeof record?.toolName === 'string' && record.toolName.length > 0) {
    return record.toolName
  }
  return undefined
}

const formatToolValidationError = (error: unknown): string | null => {
  const issues = collectIssues(error)
  if (issues.length === 0) {
    return null
  }
  const body = issues.map(formatIssue).filter((line) => line.length > 0).join('\n')
  if (!body) {
    return null
  }
  const toolName = readToolName(error)
  if (toolName) {
    return `Invalid input for tool ${toolName}\n${body}`
  }
  return body
}

export default formatToolValidationError
