import type { UIMessage } from 'ai'
import type { AgentTurn } from '@/types/chat/agent-turn'

export type ChatTimelineItem =
  | { type: 'user'; message: UIMessage }
  | { type: 'agent-turn'; turn: AgentTurn }
