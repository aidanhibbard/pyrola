import type { AgentStep } from '@/types/chat/agent-step'
import type { AgentTurnError } from '@/types/chat/agent-turn-error'

export type AgentTurn = {
  id: string
  steps: AgentStep[]
  text: string
  error?: AgentTurnError
}
