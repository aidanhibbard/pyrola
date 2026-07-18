<script setup lang="ts">
import { watch } from 'vue'
import { usePromptInput } from '@/components/ai-elements/prompt-input/context'
import useChatPromptBridge from '@/composables/use-chat-prompt-bridge'

const { textInput, setTextInput } = usePromptInput()
const chatPromptBridge = useChatPromptBridge()

watch(
  () => chatPromptBridge.mentionAppendToken.value,
  () => {
    const mention = chatPromptBridge.consumePendingMention()
    if (!mention) {
      return
    }

    const current = textInput.value.trim()
    const next = current.length > 0 ? `${current} ${mention} ` : `${mention} `
    setTextInput(next)
  },
)
</script>

<template>
  <span class="sr-only" aria-hidden="true" />
</template>
