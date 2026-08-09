<script setup lang="ts">
import { watch } from 'vue'
import { usePromptInput } from '@/components/ai-elements/prompt-input/context'
import useChatPromptBridge from '@/composables/use-chat-prompt-bridge'
import useChatPromptEditor from '@/composables/use-chat-prompt-editor'

const { textInput, setTextInput } = usePromptInput()
const chatPromptBridge = useChatPromptBridge()
const chatPromptEditor = useChatPromptEditor()

watch(
  () => chatPromptBridge.skillAppendToken.value,
  () => {
    const skill = chatPromptBridge.consumePendingSkill()
    if (!skill) {
      return
    }

    const name = skill.replace(/^\//, '').trim()
    if (!name) {
      return
    }

    if (chatPromptEditor.insertMention({ type: 'skill', name })) {
      return
    }

    const current = textInput.value.trim()
    const next = current.length > 0 ? `${current} /${name} ` : `/${name} `
    setTextInput(next)
  },
)
</script>

<template>
  <span class="sr-only" aria-hidden="true" />
</template>
