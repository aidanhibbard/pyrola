import type { UIMessage } from 'ai'
import type { AgentTurn } from '@/types/chat/agent-turn'
import type { TodoItem } from '@/types/harness/harness-event'
import type { ToolRun } from '@/types/harness/tool-run'

export type SubagentTimelineItem = {
  type: 'subagent'
  subagentId: string
  toolCallId?: string
  name: string
  blocking: boolean
  status: 'running' | 'done'
  summary?: string
  prompt?: string
  tools: ToolRun[]
}

export type ChatTimelineItem =
  | { type: 'user'; message: UIMessage }
  | { type: 'agent-turn'; turn: AgentTurn }
  | { type: 'todo'; todos: TodoItem[] }
  | SubagentTimelineItem
