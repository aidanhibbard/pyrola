import type { SubagentStatus } from '@/types/harness/subagent-record'
import type { SubagentTimelineItem } from '@/types/chat/chat-timeline-item'

export type SubagentResultOutcome = Extract<
  SubagentStatus,
  'completed' | 'failed' | 'aborted'
>

export default (
  outcome: SubagentResultOutcome | undefined,
  summary?: string,
): Exclude<SubagentTimelineItem['status'], 'running'> => {
  if (outcome === 'aborted') {
    return 'stopped'
  }
  if (outcome === 'failed') {
    return 'error'
  }
  if (outcome === 'completed') {
    return 'done'
  }

  const text = (summary ?? '').toLowerCase()
  if (text.includes('aborted') || text.includes('stopped')) {
    return 'stopped'
  }
  return 'done'
}
