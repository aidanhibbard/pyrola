import type { UIMessage } from 'ai'
import type { AgentTurn } from '@/types/chat/agent-turn'
import type { TodoItem } from '@/types/harness/harness-event'

export type SubagentTimelineItem = {
  type: 'subagent'
  subagentId: string
  name: string
  blocking: boolean
  status: 'running' | 'done'
  summary?: string
}

export type ChatTimelineItem =
  | { type: 'user'; message: UIMessage }
  | { type: 'agent-turn'; turn: AgentTurn }
  | { type: 'todo'; todos: TodoItem[] }
  | SubagentTimelineItem
