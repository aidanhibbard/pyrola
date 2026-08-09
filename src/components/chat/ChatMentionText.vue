<script setup lang="ts">
import { computed } from 'vue'
import type { MentionHighlight } from '@/types/chat/mention-highlight'
import splitChatMentionText from '@/utils/split-chat-mention-text'

const props = defineProps<{
  text: string
  highlights?: MentionHighlight[]
}>()

const segments = computed(() =>
  splitChatMentionText(props.text, props.highlights ?? []),
)
</script>

<template>
  <span class="whitespace-pre-wrap break-words">
    <template v-for="(segment, index) in segments" :key="`${segment.type}:${index}`">
      <span
        v-if="segment.type === 'mention'"
        class="chat-mention"
      >{{ segment.value }}</span>
      <span
        v-else-if="segment.type === 'skill'"
        class="chat-skill"
      >{{ segment.value }}</span>
      <template v-else>{{ segment.value }}</template>
    </template>
  </span>
</template>
