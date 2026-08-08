import type { SubagentStatus } from '@/types/harness/subagent-record'
import type { SubagentTimelineItem } from '@/types/chat/chat-timeline-item'

export type SubagentResultOutcome = Extract<
  SubagentStatus,
  'completed' | 'failed' | 'aborted'
>

const normalizeOutcome = (
  outcome: unknown,
): SubagentResultOutcome | undefined => {
  if (outcome === 'completed' || outcome === 'failed' || outcome === 'aborted') {
    return outcome
  }
  return undefined
}

export default (
  outcome: unknown,
  summary?: string,
): Exclude<SubagentTimelineItem['status'], 'running'> => {
  const normalized = normalizeOutcome(outcome)
  if (normalized === 'aborted') {
    return 'stopped'
  }
  if (normalized === 'failed') {
    return 'error'
  }
  if (normalized === 'completed') {
    return 'done'
  }

  const text = (summary ?? '').toLowerCase()
  if (text.includes('aborted') || text.includes('stopped')) {
    return 'stopped'
  }
  return 'done'
}
