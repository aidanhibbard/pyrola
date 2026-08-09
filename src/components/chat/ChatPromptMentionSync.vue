<script setup lang="ts">
import { watch } from 'vue'
import useChatPromptBridge from '@/composables/use-chat-prompt-bridge'
import useChatPromptEditor from '@/composables/use-chat-prompt-editor'

const chatPromptBridge = useChatPromptBridge()
const chatPromptEditor = useChatPromptEditor()

watch(
  () => chatPromptBridge.mentionAppendToken.value,
  () => {
    const mention = chatPromptBridge.consumePendingMention()
    if (!mention) {
      return
    }
    chatPromptEditor.insertMention(mention)
  },
)
</script>

<template>
  <span class="sr-only" aria-hidden="true" />
</template>
