<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { InputGroup } from '@/components/ui/input-group'
import { cn } from '@/lib/utils'
import { computed, provide } from 'vue'
import { SnippetKey } from './context'

type InputGroupProps = InstanceType<typeof InputGroup>['$props']

interface Props extends /* @vue-ignore */ InputGroupProps {
  code: string
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()

provide(SnippetKey, {
  code: computed(() => props.code),
})
</script>

<template>
  <InputGroup
    :class="cn('font-mono', props.class)"
    v-bind="$attrs"
  >
    <slot />
  </InputGroup>
</template>
