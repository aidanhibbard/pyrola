import type { PyrolaChatMode } from '@/types/pyrola/pyrola-settings'

const PENDING_MESSAGE_KEY = 'pyrola:pending-chat-message'

export type PendingChatMessage = {
  text: string
  mode: PyrolaChatMode
  model: string
}

export const setPendingChatMessage = (payload: PendingChatMessage): void => {
  sessionStorage.setItem(PENDING_MESSAGE_KEY, JSON.stringify(payload))
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
