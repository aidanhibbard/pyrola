import { ref } from 'vue'
import type { Ref } from 'vue'
import type { QueuedChatMessage } from '@/types/chat/queued-chat-message'

const MAX_QUEUE_SIZE = 10

export default () => {
  const items = ref<QueuedChatMessage[]>([]) as Ref<QueuedChatMessage[]>

  const peek = (): QueuedChatMessage | undefined => {
    return items.value[0]
  }

  const enqueue = (item: Omit<QueuedChatMessage, 'id'>): string => {
    if (items.value.length >= MAX_QUEUE_SIZE) {
      throw new Error(`Message queue is full (max ${MAX_QUEUE_SIZE})`)
    }
    const id = crypto.randomUUID()
    items.value = [...items.value, { ...item, id }]
    return id
  }

  const remove = (id: string): void => {
    items.value = items.value.filter((entry) => entry.id !== id)
  }

  const take = (): QueuedChatMessage | undefined => {
    const head = items.value[0]
    if (!head) {
      return undefined
    }
    items.value = items.value.slice(1)
    return head
  }

  const clear = (): void => {
    items.value = []
  }

  return {
    items,
    maxSize: MAX_QUEUE_SIZE,
    enqueue,
    remove,
    take,
    clear,
    peek,
  }
}
