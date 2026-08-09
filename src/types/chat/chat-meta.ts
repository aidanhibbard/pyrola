import type { ChatAttention } from '@/types/chat/chat-attention'
import type { AwaitingPlanGo } from '@/types/plans/awaiting-plan-go'
import type { PyrolaChatMode } from '@/types/pyrola/pyrola-settings'
import type { PrefixSnapshot } from '@/types/harness/prefix-snapshot'

export type ChatStatus = 'idle' | 'running'

export type ChatMeta = {
  id: string
  title: string
  projectSlug: string
  projectRoot: string
  mode: PyrolaChatMode
  model: string
  status: ChatStatus
  attention?: ChatAttention
  createdAt: string
  updatedAt: string
  forkedFrom: string | null
  pinned: boolean
  pinnedAt: string | null
  prefixSnapshot?: PrefixSnapshot
  activeContext?: {
    checkpointLineId?: string
    includeFromCreatedAt?: string
    summary?: string
  }
  awaitingPlanGo?: AwaitingPlanGo | null
  subagentModel?: string | null
  reasoning?: string | null
  subagentReasoning?: string | null
}
