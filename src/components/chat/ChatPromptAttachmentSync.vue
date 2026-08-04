<script setup lang="ts">
import { watch } from 'vue'
import { usePromptInput } from '@/components/ai-elements/prompt-input/context'
import useChatPromptBridge from '@/composables/use-chat-prompt-bridge'
import type { AttachmentFile } from '@/components/ai-elements/prompt-input/types'

const { textInput, setTextInput, files } = usePromptInput()
const chatPromptBridge = useChatPromptBridge()

watch(
  () => chatPromptBridge.attachmentAppendToken.value,
  () => {
    const pending = chatPromptBridge.consumePendingAttachments()
    if (pending.text) {
      const current = textInput.value.trim()
      const next =
        current.length > 0
          ? `${pending.text}\n\n${current}`
          : pending.text
      setTextInput(next)
    }
    if (pending.files.length === 0) {
      return
    }
    const mapped: AttachmentFile[] = pending.files.map((file, index) => ({
      ...file,
      id: `browser-element-${Date.now()}-${index}`,
    }))
    files.value = [...files.value, ...mapped]
  },
)
</script>

<template>
  <span class="sr-only" aria-hidden="true" />
</template>
