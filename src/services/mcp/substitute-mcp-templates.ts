const INPUT_PATTERN = /\$\{input:([^}]+)\}/g
const ENV_PATTERN = /\$\{env:([^}]+)\}/g

export type McpTemplateContext = {
  inputs: Record<string, string>
  env: Record<string, string>
}

export const collectMcpTemplateInputIds = (value: string): string[] => {
  const ids: string[] = []
  for (const match of value.matchAll(INPUT_PATTERN)) {
    const id = match[1]?.trim()
    if (id) {
      ids.push(id)
    }
  }
  return ids
}

export const substituteMcpTemplate = (
  value: string,
  context: McpTemplateContext,
): string => {
  const withInputs = value.replace(INPUT_PATTERN, (_full, id: string) => {
    const key = id.trim()
    const resolved = context.inputs[key]
    if (resolved === undefined) {
      throw new Error(`Missing MCP input: ${key}`)
    }
    return resolved
  })

  return withInputs.replace(ENV_PATTERN, (_full, name: string) => {
    const key = name.trim()
    const resolved = context.env[key]
    if (resolved === undefined) {
      throw new Error(`Missing environment variable: ${key}`)
    }
    return resolved
  })
}

export const substituteMcpRecord = (
  record: Record<string, string> | undefined,
  context: McpTemplateContext,
): Record<string, string> => {
  if (!record) {
    return {}
  }
  const next: Record<string, string> = {}
  for (const [key, value] of Object.entries(record)) {
    next[key] = substituteMcpTemplate(value, context)
  }
  return next
}

export const collectRecordInputIds = (
  record: Record<string, string> | undefined,
): string[] => {
  if (!record) {
    return []
  }
  const ids: string[] = []
  for (const value of Object.values(record)) {
    ids.push(...collectMcpTemplateInputIds(value))
  }
  return [...new Set(ids)]
}
