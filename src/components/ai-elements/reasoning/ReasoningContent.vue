<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { CollapsibleContent } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { computed } from 'vue'
import { Markdown } from 'vue-stream-markdown'
import 'vue-stream-markdown/index.css'

interface Props {
  class?: HTMLAttributes['class']
  content: string
}

const props = defineProps<Props>()

const md = computed(() => props.content)
</script>

<template>
  <CollapsibleContent
    :class="cn(
      'mt-4 text-sm',
      'data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2',
      'data-[state=open]:slide-in-from-top-2 text-muted-foreground',
      'outline-none data-[state=closed]:animate-out data-[state=open]:animate-in',
      props.class,
    )"
  >
    <Markdown
      v-if="md"
      :content="md"
      class="chat-markdown min-w-0 max-w-full overflow-hidden"
    />
    <slot />
  </CollapsibleContent>
</template>
