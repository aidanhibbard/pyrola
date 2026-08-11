<script setup lang="ts">
import { watch } from 'vue'
import useChatPromptBridge from '@/composables/use-chat-prompt-bridge'
import useChatPromptDraftMedia from '@/composables/use-chat-prompt-draft-media'

const chatPromptBridge = useChatPromptBridge()
const draftMedia = useChatPromptDraftMedia()

watch(
  () => chatPromptBridge.browserElementAppendToken.value,
  () => {
    const selection = chatPromptBridge.consumePendingBrowserElement()
    if (!selection) {
      return
    }
    draftMedia.append(selection)
  },
)
</script>

<template>
  <span class="sr-only" aria-hidden="true" />
</template>
