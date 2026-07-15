<script setup lang="ts">
import type { AcceptableValue } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { Command } from '@/components/ui/command'
import { PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useMicSelector } from './context'

type PopoverContentProps = InstanceType<typeof PopoverContent>['$props']
type CommandProps = InstanceType<typeof Command>['$props']

interface Props extends /* @vue-ignore */ CommandProps {
  class?: HTMLAttributes['class']
  popoverOptions?: PopoverContentProps
}

const props = defineProps<Props>()

const { width, value, setValue } = useMicSelector('MicSelectorContent')

function handleValueChange(newValue: AcceptableValue) {
  if (typeof newValue === 'string') {
    setValue(newValue)
  }
}
</script>

<template>
  <PopoverContent
    :class="cn('p-0', props.class)"
    :style="{ width: `${width}px` }"
    v-bind="props.popoverOptions"
  >
    <Command
      :model-value="value"
      v-bind="$attrs"
      @update:model-value="handleValueChange"
    >
      <slot />
    </Command>
  </PopoverContent>
</template>
