import type { PermissionLevel } from '@/types/harness/permission'
import type { PyrolaChatMode } from '@/types/pyrola/pyrola-settings'

const PENDING_MESSAGE_KEY = 'pyrola:pending-chat-message'
export const PENDING_CHAT_MESSAGE_EVENT = 'pyrola:pending-chat-message'

export type PendingChatMessage = {
  text: string
  mode: PyrolaChatMode
  model: string
  permissionLevel?: PermissionLevel
  subagentModel?: string
}

export const setPendingChatMessage = (payload: PendingChatMessage): void => {
  sessionStorage.setItem(PENDING_MESSAGE_KEY, JSON.stringify(payload))
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PENDING_CHAT_MESSAGE_EVENT))
  }
}

export const consumePendingChatMessage = (): PendingChatMessage | null => {
  const raw = sessionStorage.getItem(PENDING_MESSAGE_KEY)
  if (!raw) {
    return null
  }
  sessionStorage.removeItem(PENDING_MESSAGE_KEY)
  try {
    return JSON.parse(raw) as PendingChatMessage
  } catch {
    return null
  }
}

export const peekPendingChatMessage = (): PendingChatMessage | null => {
  const raw = sessionStorage.getItem(PENDING_MESSAGE_KEY)
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as PendingChatMessage
  } catch {
    return null
  }
}
