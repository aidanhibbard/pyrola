import type { HarnessEvent } from '@/types/harness/harness-event'

export type SubagentEntry = {
  subagentId: string
  name: string
  blocking: boolean
  status: 'running' | 'done' | 'stopped' | 'error'
  summary?: string
  events: HarnessEvent[]
}
