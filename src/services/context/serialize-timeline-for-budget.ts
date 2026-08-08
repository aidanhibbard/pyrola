import type { UIMessage } from 'ai'
import type { AgentTurn } from '@/types/chat/agent-turn'
import type { ChatTimelineItem } from '@/types/chat/chat-timeline-item'
import type { ToolRun } from '@/types/harness/tool-run'

const serializeMessageParts = (message: UIMessage): string =>
  message.parts
    .map((part) => {
      if (part.type === 'text' || part.type === 'reasoning') {
        return part.text
      }
      return JSON.stringify(part)
    })
    .join('\n')

const serializeToolRun = (tool: ToolRun): string => {
  const chunks = [
    `tool:${tool.name}`,
    `id:${tool.toolCallId}`,
    `status:${tool.status}`,
  ]
  if (tool.args !== undefined) {
    chunks.push(`args:${JSON.stringify(tool.args)}`)
  }
  if (tool.result !== undefined) {
    chunks.push(`result:${JSON.stringify(tool.result)}`)
  }
  return chunks.join('\n')
}

const serializeAgentTurn = (turn: AgentTurn): string => {
  const chunks: string[] = []
  for (const step of turn.steps) {
    if (step.reasoning) {
      chunks.push(step.reasoning)
    }
    if (step.text) {
      chunks.push(step.text)
    }
    for (const tool of step.tools) {
      chunks.push(serializeToolRun(tool))
    }
  }
  if (turn.text.trim()) {
    chunks.push(turn.text)
  }
  return chunks.join('\n')
}

const getUserCreatedAt = (message: UIMessage): string | null => {
  if (
    message.metadata &&
    typeof message.metadata === 'object' &&
    typeof (message.metadata as Record<string, unknown>).createdAt === 'string'
  ) {
    return (message.metadata as Record<string, unknown>).createdAt as string
  }
  return null
}

export type SerializeTimelineForBudgetInput = {
  timeline: ChatTimelineItem[]
  checkpointText?: string
  includeFromCreatedAt?: string
}

/**
 * Serialize chat timeline content for context-budget estimates.
 * Includes user text and assistant text/reasoning plus tool args/results.
 * Skips subagent nested tool streams (parent context only sees spawn summaries)
 * and todo markers.
 */
export default (input: SerializeTimelineForBudgetInput): string => {
  const cutoff = input.includeFromCreatedAt
  const chunks: string[] = []
  let pastCutoff = !cutoff

  for (const item of input.timeline) {
    if (item.type === 'user') {
      const createdAt = getUserCreatedAt(item.message)
      if (cutoff && createdAt) {
        pastCutoff = createdAt >= cutoff
      } else if (cutoff && !createdAt) {
        pastCutoff = true
      }
      if (!pastCutoff) {
        continue
      }
      chunks.push(serializeMessageParts(item.message))
      continue
    }

    if (!pastCutoff) {
      continue
    }

    if (item.type === 'agent-turn') {
      chunks.push(serializeAgentTurn(item.turn))
      continue
    }

    // Compaction summaries are represented via activeContext checkpointText.
    // Nested subagent tools are not part of the parent model prompt.
  }

  const body = chunks.filter((chunk) => chunk.length > 0).join('\n\n')
  const checkpointText = input.checkpointText ?? ''
  if (!checkpointText) {
    return body
  }
  if (!body) {
    return checkpointText
  }
  return `${checkpointText}\n\n${body}`
}
