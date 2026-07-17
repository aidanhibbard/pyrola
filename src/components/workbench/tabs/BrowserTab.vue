<script setup lang="ts">
import { computed } from 'vue'
import type { BrowserPayload, WorkbenchTab } from '@/types/workbench/workbench-tab'

const props = defineProps<{
  tab: WorkbenchTab
}>()

const url = computed(() => (props.tab.payload as BrowserPayload).url)
</script>

<template>
  <div class="flex h-full min-h-0 flex-col items-center justify-center gap-3 p-6 text-center">
    <p class="text-sm font-medium">Browser</p>
    <p class="text-sm text-muted-foreground">
      Webview preview coming soon.
    </p>
    <p class="max-w-sm truncate text-xs text-muted-foreground">
      {{ url }}
    </p>
  </div>
</template>
