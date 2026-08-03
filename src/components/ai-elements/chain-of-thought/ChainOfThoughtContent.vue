<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import {
  Collapsible,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { useChainOfThought } from './context'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()

const { isOpen } = useChainOfThought()
</script>

<template>
  <Collapsible :open="isOpen">
    <CollapsibleContent
      :class="
        cn(
          'mt-1.5 space-y-3 border-l border-border/70 pl-3 text-xs text-muted-foreground',
          'data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 outline-none data-[state=closed]:animate-out data-[state=open]:animate-in',
          props.class,
        )
      "
      v-bind="$attrs"
    >
      <slot />
    </CollapsibleContent>
  </Collapsible>
</template>
