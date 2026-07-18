import type { HarnessEvent } from '@/types/harness/harness-event'

export type SubagentEntry = {
  subagentId: string
  name: string
  blocking: boolean
  status: 'running' | 'done'
  summary?: string
  events: HarnessEvent[]
}
