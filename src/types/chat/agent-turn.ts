import type { AgentStep } from '@/types/chat/agent-step'

export type AgentTurn = {
  id: string
  steps: AgentStep[]
  text: string
}
