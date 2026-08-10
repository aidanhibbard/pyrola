<script setup lang="ts">
import { watch } from 'vue'
import useChatPromptBridge from '@/composables/use-chat-prompt-bridge'
import useChatPromptEditor from '@/composables/use-chat-prompt-editor'

// v1 stages the browser-element mention (detail + screenshotPath) into the
// TipTap draft. Attaching the cropped PNG via addFiles is deferred: temp
// screenshot paths are outside the project root and have no simple File reader
// yet. The agent can read screenshotPath from the mention text.
const chatPromptBridge = useChatPromptBridge()
const chatPromptEditor = useChatPromptEditor()

watch(
  () => chatPromptBridge.browserElementAppendToken.value,
  () => {
    const selection = chatPromptBridge.consumePendingBrowserElement()
    if (!selection) {
      return
    }
    chatPromptEditor.insertMention({
      type: 'browser-element',
      detail: selection.detail,
      screenshotPath: selection.screenshotPath,
    })
  },
)
</script>

<template>
  <span class="sr-only" aria-hidden="true" />
</template>
