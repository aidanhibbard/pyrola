<script setup lang="ts">
import { computed } from 'vue'
import WorkbenchTabsChangesTab from '@/components/workbench/tabs/ChangesTab.vue'
import WorkbenchTabsEditorTab from '@/components/workbench/tabs/EditorTab.vue'
import WorkbenchTabsTerminalTab from '@/components/workbench/tabs/TerminalTab.vue'
import WorkbenchTabsBrowserTab from '@/components/workbench/tabs/BrowserTab.vue'
import WorkbenchTabsPlanTab from '@/components/workbench/tabs/PlanTab.vue'
import WorkbenchTabsStudioTab from '@/components/workbench/tabs/StudioTab.vue'
import useWorkbenchStore from '@/composables/use-workbench-store'
import type { WorkbenchTabType } from '@/types/workbench/workbench-tab'

const workbench = useWorkbenchStore()

const tabComponentMap: Record<WorkbenchTabType, object> = {
  changes: WorkbenchTabsChangesTab,
  editor: WorkbenchTabsEditorTab,
  terminal: WorkbenchTabsTerminalTab,
  browser: WorkbenchTabsBrowserTab,
  plan: WorkbenchTabsPlanTab,
  studio: WorkbenchTabsStudioTab,
}

const activeTabId = computed(() => workbench.activeTabId.value)
</script>

<template>
  <div class="relative h-full min-h-0 overflow-hidden">
    <div
      v-for="tab in workbench.tabs.value"
      :key="tab.id"
      v-show="tab.id === activeTabId"
      class="absolute inset-0 min-h-0 overflow-hidden"
    >
      <component :is="tabComponentMap[tab.type]" :tab="tab" />
    </div>
  </div>
</template>
