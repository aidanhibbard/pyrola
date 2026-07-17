import type { PlanTodoItem } from '@/types/workbench/workbench-tab'

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/

const slugify = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'plan'

const formatTimestamp = (date: Date): string => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

const formatTodos = (todos: PlanTodoItem[]): string => {
  if (todos.length === 0) {
    return 'todos: []'
  }
  const lines = ['todos:']
  for (const todo of todos) {
    lines.push(`  - id: ${todo.id}`)
    lines.push(`    content: ${JSON.stringify(todo.content)}`)
    lines.push(`    status: ${todo.status}`)
  }
  return lines.join('\n')
}

export type CreatePlanInput = {
  title: string
  body: string
  todos?: PlanTodoItem[]
  sourceChatId?: string
}

export type CreatePlanResult = {
  planId: string
  path: string
  content: string
}

export default (input: CreatePlanInput): CreatePlanResult => {
  const now = new Date()
  const planId = `${slugify(input.title)}-${formatTimestamp(now)}`
  const path = `.pyrola/plans/${planId}/PLAN.md`
  const todos = input.todos ?? []
  const sourceChatLine = input.sourceChatId
    ? `sourceChatId: ${input.sourceChatId}\n`
    : ''
  const content = `---
id: ${planId}
title: ${JSON.stringify(input.title)}
createdAt: ${now.toISOString()}
mode: plan
${sourceChatLine}${formatTodos(todos)}
---

${input.body.trim()}
`

  return { planId, path, content }
}

export const updatePlanTodos = (
  existingContent: string,
  todos: PlanTodoItem[],
): string => {
  const frontmatterMatch = existingContent.match(FRONTMATTER_RE)
  if (!frontmatterMatch) {
    return existingContent
  }

  const yaml = frontmatterMatch[1] ?? ''
  const body = frontmatterMatch[2] ?? ''
  const lines = yaml.split('\n').filter((line) => !line.trim().startsWith('todos:'))
  const trimmedYaml = lines.join('\n').trimEnd()
  const nextYaml = `${trimmedYaml}\n${formatTodos(todos)}`
  return `---\n${nextYaml}\n---\n\n${body.trimStart()}`
}
