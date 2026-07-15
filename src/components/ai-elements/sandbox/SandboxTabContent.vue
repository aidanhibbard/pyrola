<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

type TabsContentProps = InstanceType<typeof TabsContent>['$props']

interface Props extends /* @vue-ignore */ TabsContentProps {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <TabsContent :class="cn('mt-0 text-sm', props.class)" v-bind="{ ...props, ...$attrs }">
    <slot />
  </TabsContent>
</template>
