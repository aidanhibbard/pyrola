import { planFrontmatterSchema, formatPlanSchemaError } from '@/schemas/plan-document'
import type { ParsedPlan, PlanTodoItem } from '@/types/plans/plan-document'

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/

const parseYamlValue = (raw: string): string => {
  const trimmed = raw.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

const parseTodos = (lines: string[], startIndex: number): { todos: PlanTodoItem[]; end: number } => {
  const todos: PlanTodoItem[] = []
  let index = startIndex
  let current: Partial<PlanTodoItem> | null = null

  while (index < lines.length) {
    const line = lines[index]!
    if (line.trim() === '' || !line.startsWith(' ')) {
      break
    }
    const trimmed = line.trim()
    if (trimmed.startsWith('- id:')) {
      if (current?.id && current.content) {
        todos.push({
          id: current.id,
          content: current.content,
          status: current.status ?? 'pending',
        })
      }
      current = { id: parseYamlValue(trimmed.slice(5)) }
    } else if (trimmed.startsWith('content:') && current) {
      current.content = parseYamlValue(trimmed.slice(8))
    } else if (trimmed.startsWith('status:') && current) {
      const status = parseYamlValue(trimmed.slice(7)) as PlanTodoItem['status']
      current.status = status
    }
    index += 1
  }

  if (current?.id && current.content) {
    todos.push({
      id: current.id,
      content: current.content,
      status: current.status ?? 'pending',
    })
  }

  return { todos, end: index }
}

const parseYamlFrontmatter = (yaml: string): Record<string, unknown> => {
  const lines = yaml.split('\n')
  const data: Record<string, unknown> = {}
  let index = 0

  while (index < lines.length) {
    const line = lines[index]!
    if (line.trim() === '') {
      index += 1
      continue
    }
    if (line.startsWith('todos:')) {
      const inline = line.slice(6).trim()
      if (inline === '[]') {
        data.todos = []
        index += 1
        continue
      }
      const parsed = parseTodos(lines, index + 1)
      data.todos = parsed.todos
      index = parsed.end
      continue
    }
    const colon = line.indexOf(':')
    if (colon > 0) {
      const key = line.slice(0, colon).trim()
      const value = parseYamlValue(line.slice(colon + 1))
      data[key] = value
    }
    index += 1
  }

  return data
}

export default (content: string): ParsedPlan => {
  const match = content.match(FRONTMATTER_RE)
  if (!match) {
    return {
      frontmatter: null,
      body: content,
      parseError: 'Plan file is missing YAML frontmatter (expected --- delimiters).',
    }
  }

  const body = match[2]?.trim() ?? ''
  const rawFrontmatter = parseYamlFrontmatter(match[1] ?? '')
  const result = planFrontmatterSchema.safeParse(rawFrontmatter)

  if (!result.success) {
    return {
      frontmatter: null,
      body,
      parseError: `Invalid plan frontmatter: ${formatPlanSchemaError(result.error)}`,
    }
  }

  return {
    frontmatter: result.data,
    body,
  }
}
