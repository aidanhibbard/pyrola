<script setup lang="ts">
import { watch } from 'vue'
import { usePromptInput } from '@/components/ai-elements/prompt-input/context'
import useChatPromptBridge from '@/composables/use-chat-prompt-bridge'

const { textInput, setTextInput } = usePromptInput()
const chatPromptBridge = useChatPromptBridge()

watch(
  () => chatPromptBridge.skillAppendToken.value,
  () => {
    const skill = chatPromptBridge.consumePendingSkill()
    if (!skill) {
      return
    }

    const current = textInput.value.trim()
    const next = current.length > 0 ? `${current} ${skill} ` : `${skill} `
    setTextInput(next)
  },
)
</script>

<template>
  <span class="sr-only" aria-hidden="true" />
</template>
