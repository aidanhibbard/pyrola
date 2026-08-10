import type { ChatTimelineItem, SubagentTimelineItem } from '@/types/chat/chat-timeline-item'
import type { TodoItem, HarnessEvent } from '@/types/harness/harness-event'
import applySubagentToolEvent from '@/utils/apply-subagent-tool-event'

export const upsertTodoTimelineItem = (
  items: ChatTimelineItem[],
  todos: TodoItem[],
): ChatTimelineItem[] => {
  if (todos.length === 0) {
    return items
  }
  const next = [...items]
  const last = next.at(-1)
  if (last?.type === 'todo') {
    next[next.length - 1] = { type: 'todo', todos }
    return next
  }
  return [...next, { type: 'todo', todos }]
}

export const upsertSubagentStart = (
  items: ChatTimelineItem[],
  subagent: Omit<SubagentTimelineItem, 'type' | 'status' | 'tools'> & {
    tools?: SubagentTimelineItem['tools']
  },
): ChatTimelineItem[] => {
  const index = items.findIndex(
    (item) => item.type === 'subagent' && item.subagentId === subagent.subagentId,
  )
  if (index >= 0) {
    const next = [...items]
    const existing = next[index]
    if (existing?.type === 'subagent') {
      next[index] = {
        ...existing,
        toolCallId: subagent.toolCallId ?? existing.toolCallId,
        name: subagent.name,
        blocking: subagent.blocking,
        prompt: subagent.prompt ?? existing.prompt,
        model: subagent.model ?? existing.model,
        tools: subagent.tools ?? existing.tools,
      }
    }
    return next
  }
  return [
    ...items,
    {
      type: 'subagent',
      subagentId: subagent.subagentId,
      toolCallId: subagent.toolCallId,
      name: subagent.name,
      blocking: subagent.blocking,
      prompt: subagent.prompt,
      model: subagent.model,
      status: 'running',
      tools: subagent.tools ?? [],
    },
  ]
}

export const completeSubagentTimelineItem = (
  items: ChatTimelineItem[],
  subagentId: string,
  summary: string,
  status: Exclude<SubagentTimelineItem['status'], 'running'> = 'done',
): ChatTimelineItem[] => {
  const index = items.findIndex(
    (item) => item.type === 'subagent' && item.subagentId === subagentId,
  )
  if (index >= 0) {
    const next = [...items]
    const existing = next[index]
    if (existing?.type === 'subagent') {
      next[index] = {
        ...existing,
        status,
        summary,
      }
    }
    return next
  }
  return [
    ...items,
    {
      type: 'subagent',
      subagentId,
      name: 'Sub-agent',
      blocking: false,
      status,
      summary,
      tools: [],
    },
  ]
}

export const appendSubagentToolEvent = (
  items: ChatTimelineItem[],
  subagentId: string,
  event: HarnessEvent,
): ChatTimelineItem[] => {
  const index = items.findIndex(
    (item) => item.type === 'subagent' && item.subagentId === subagentId,
  )
  if (index < 0) {
    return items
  }
  const existing = items[index]
  if (existing?.type !== 'subagent') {
    return items
  }
  const next = [...items]
  next[index] = {
    ...existing,
    tools: applySubagentToolEvent(existing.tools, event),
  }
  return next
}

export const setSubagentPrompt = (
  items: ChatTimelineItem[],
  subagentId: string,
  prompt: string,
): ChatTimelineItem[] => {
  const index = items.findIndex(
    (item) => item.type === 'subagent' && item.subagentId === subagentId,
  )
  if (index < 0) {
    return items
  }
  const existing = items[index]
  if (existing?.type !== 'subagent') {
    return items
  }
  const next = [...items]
  next[index] = {
    ...existing,
    prompt,
  }
  return next
}
