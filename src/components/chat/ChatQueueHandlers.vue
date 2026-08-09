<script setup lang="ts">
import type { QueuedChatMessage } from '@/types/chat/queued-chat-message'
import useQueueHydrate from '@/composables/use-queue-hydrate'

// Must be rendered inside a <PromptInput> subtree; useQueueHydrate() calls
// usePromptInput() at setup, which injects the prompt input context.
const { hydrateQueuedMessage } = useQueueHydrate()

defineExpose<{
  hydrateQueuedMessage: (item: QueuedChatMessage) => Promise<void>
}>({
  hydrateQueuedMessage,
})
</script>

<template>
  <span class="sr-only" aria-hidden="true" />
</template>
