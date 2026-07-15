<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Collapsible } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

type CommitProps = InstanceType<typeof Collapsible>['$props']

interface Props extends /* @vue-ignore */ CommitProps {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <Collapsible
    :class="cn('rounded-lg border bg-background', props.class)"
    v-bind="$attrs"
  >
    <slot />
  </Collapsible>
</template>
