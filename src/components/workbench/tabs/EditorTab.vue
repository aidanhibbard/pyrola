<script setup lang="ts">
import { computed } from 'vue'
import WorkbenchFileTree from '@/components/workbench/FileTree.vue'
import WorkbenchMonacoEditor from '@/components/workbench/MonacoEditor.vue'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/shadcn/ui/resizable'
import useWorkbenchStore from '@/composables/use-workbench-store'
import type { EditorPayload, WorkbenchTab } from '@/types/workbench/workbench-tab'

const props = defineProps<{
  tab: WorkbenchTab
}>()

const workbench = useWorkbenchStore()

const editorPayload = computed(() => props.tab.payload as EditorPayload)
const selectedPath = computed(() => editorPayload.value.path)

const handleSelect = (path: string): void => {
  workbench.openEditor(props.tab.projectId, path)
}
</script>

<template>
  <ResizablePanelGroup
    direction="horizontal"
    class="h-full min-h-0 overflow-hidden"
  >
    <ResizablePanel
      :default-size="75"
      :min-size="40"
      class="min-h-0 min-w-0 overflow-hidden"
    >
      <div class="h-full min-h-0 overflow-hidden">
        <WorkbenchMonacoEditor
          :project-id="tab.projectId"
          :path="selectedPath"
        />
      </div>
    </ResizablePanel>
    <ResizableHandle />
    <ResizablePanel
      :default-size="25"
      :min-size="15"
      :max-size="40"
      class="min-h-0 min-w-0 overflow-hidden"
    >
      <WorkbenchFileTree
        :project-id="tab.projectId"
        :selected-path="selectedPath"
        @select="handleSelect"
      />
    </ResizablePanel>
  </ResizablePanelGroup>
</template>
