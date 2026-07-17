<script setup lang="ts">
import { computed } from 'vue'
import { PanelRight } from '@lucide/vue'
import WorkbenchTabContent from '@/components/workbench/WorkbenchTabContent.vue'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/shadcn/ui/empty'
import useWorkbenchStore from '@/composables/use-workbench-store'

const workbench = useWorkbenchStore()

const hasTabs = computed(() => workbench.tabs.value.length > 0)
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden">
    <Empty v-if="!hasTabs" class="flex-1 border-none">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <PanelRight />
        </EmptyMedia>
        <EmptyTitle>No tabs open</EmptyTitle>
        <EmptyDescription>
          Use + to open an editor, terminal, browser, or changes tab — or start a Plan or Studio chat.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
    <WorkbenchTabContent v-else class="min-h-0 flex-1" />
  </div>
</template>
