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
}
