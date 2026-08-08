<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { InputGroupAddon } from '@/components/ui/input-group'
import { cn } from '@/lib/utils'

type PromptInputHeaderProps = InstanceType<typeof InputGroupAddon>['$props']

interface Props extends /* @vue-ignore */ Omit<PromptInputHeaderProps, 'align'> {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <InputGroupAddon
    align="block-start"
    :class="cn('order-first w-full flex-wrap gap-1', props.class)"
  >
    <slot />
  </InputGroupAddon>
</template>
