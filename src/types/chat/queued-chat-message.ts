import type { FileUIPart } from 'ai'
import type { ContextMention } from '@/types/harness/context-mention'
import type { PyrolaChatMode } from '@/types/pyrola/pyrola-settings'
import type { ReasoningLevel } from '@/types/models/reasoning-level'

export interface QueuedChatMessage {
  id: string
  text: string
  files: FileUIPart[]
  mode: PyrolaChatMode
  model: string
  reasoning?: ReasoningLevel
  mentions?: ContextMention[]
}
