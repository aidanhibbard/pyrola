<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { CollapsibleContent } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

type TestSuiteContentProps = InstanceType<typeof CollapsibleContent>['$props']

interface Props extends /* @vue-ignore */ TestSuiteContentProps {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <CollapsibleContent
    :class="cn('border-t', props.class)"
    v-bind="$attrs"
  >
    <div class="divide-y">
      <slot />
    </div>
  </CollapsibleContent>
</template>
