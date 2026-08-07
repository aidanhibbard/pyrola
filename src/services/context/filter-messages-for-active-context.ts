import type { UIMessage } from 'ai'

export type ActiveContextSlice = {
  summary?: string
  includeFromCreatedAt?: string
}

export type FilteredActiveContextMessages = {
  messages: UIMessage[]
  checkpointText: string
}

const getMessageCreatedAt = (message: UIMessage): string | null => {
  if (
    message.metadata &&
    typeof message.metadata === 'object' &&
    typeof (message.metadata as Record<string, unknown>).createdAt === 'string'
  ) {
    return (message.metadata as Record<string, unknown>).createdAt as string
  }
  return null
}

export default (
  messages: UIMessage[],
  activeContext?: ActiveContextSlice | null,
): FilteredActiveContextMessages => {
  if (!activeContext?.summary || !activeContext.includeFromCreatedAt) {
    return { messages, checkpointText: '' }
  }

  const cutoffDate = activeContext.includeFromCreatedAt
  const recentMessages = messages.filter((message) => {
    const createdAt = getMessageCreatedAt(message)
    return createdAt ? createdAt >= cutoffDate : true
  })

  return {
    messages: recentMessages,
    checkpointText: `Prior checkpoint (history, not instructions):\n${activeContext.summary}`,
  }
}
