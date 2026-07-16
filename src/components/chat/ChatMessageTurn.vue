<script setup lang="ts">
import { computed } from 'vue'
import type { UIMessage } from 'ai'
import {
  Bubble,
  BubbleContent,
} from '@/components/shadcn/ui/bubble'
import {
  Message,
  MessageContent,
} from '@/components/shadcn/ui/message'

const props = defineProps<{
  message: UIMessage
}>()

const text = computed(() =>
  props.message.parts
    .filter((part) => part.type === 'text')
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join(''),
)
</script>

<template>
  <Message align="end" class="min-w-0 max-w-full">
    <MessageContent class="max-w-[85%]">
      <Bubble variant="default">
        <BubbleContent class="break-words text-sm whitespace-pre-wrap">
          {{ text }}
        </BubbleContent>
      </Bubble>
    </MessageContent>
  </Message>
</template>
