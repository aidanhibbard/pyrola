<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'
import { Comment, computed, useSlots } from 'vue'
import { Markdown } from 'vue-stream-markdown'
import 'vue-stream-markdown/index.css'

interface Props {
  content?: string
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()

const slots = useSlots()
const slotContent = computed<string | undefined>(() => {
  const nodes = slots.default?.()
  if (!Array.isArray(nodes)) {
    return undefined
  }
  let text = ''
  for (const node of nodes) {
    if (node.type === Comment) {
      continue
    }
    if (typeof node.children === 'string') {
      text += node.children
    }
  }
  return text || undefined
})

const md = computed(() => (props.content ?? slotContent.value ?? '') as string)
</script>

<template>
  <Markdown
    :content="md"
    :class="
      cn(
        'w-full min-w-0 max-w-full overflow-hidden break-words [&_code]:break-words [&_p]:break-words [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_table]:w-full [&_table]:table-fixed',
        '[&>*:first-child]:mt-0! [&>*:last-child]:mb-0!',
        props.class,
      )
    "
    v-bind="$attrs"
  />
</template>
