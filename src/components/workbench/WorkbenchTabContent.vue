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
    <template v-for="tab in workbench.tabs.value" :key="tab.id">
      <!--
        Browser must unmount when inactive: the native child webview is not
        clipped by v-show and would stay painted over the rest of the app.
      -->
      <div
        v-if="tab.type === 'browser' ? tab.id === activeTabId : true"
        v-show="tab.type === 'browser' || tab.id === activeTabId"
        class="absolute inset-0 min-h-0 overflow-hidden"
      >
        <component :is="tabComponentMap[tab.type]" :tab="tab" />
      </div>
    </template>
  </div>
</template>
