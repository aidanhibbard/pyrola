import type { ToolRun } from '@/types/harness/tool-run'

export type AgentStep = {
  id: string
  reasoning: string
  tools: ToolRun[]
}
