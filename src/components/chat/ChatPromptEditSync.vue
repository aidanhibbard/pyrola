<script setup lang="ts">
import { watch } from 'vue'
import { usePromptInput } from '@/components/ai-elements/prompt-input/context'
import useChatStore from '@/composables/use-chat-store'

const { setTextInput } = usePromptInput()
const chatStore = useChatStore()

watch(
  () => chatStore.editingMessageId.value,
  (messageId) => {
    if (messageId) {
      setTextInput(chatStore.editDraftText.value)
      return
    }
    setTextInput('')
  },
)

watch(
  () => chatStore.editDraftText.value,
  (text) => {
    if (chatStore.editingMessageId.value) {
      setTextInput(text)
    }
  },
)
</script>

<template>
  <span class="sr-only" aria-hidden="true" />
</template>
