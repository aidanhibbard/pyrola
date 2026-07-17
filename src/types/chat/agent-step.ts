import type { ToolRun } from '@/types/harness/tool-run'

export type AgentStep = {
  id: string
  text: string
  reasoning: string
  tools: ToolRun[]
}
