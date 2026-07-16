<script setup lang="ts">
import { ref } from 'vue'
import WorkbenchFileTree from '@/components/workbench/FileTree.vue'
import WorkbenchMonacoEditor from '@/components/workbench/MonacoEditor.vue'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/shadcn/ui/resizable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/shadcn/ui/tabs'

const selectedPath = ref<string | null>(null)

const handleSelect = (path: string): void => {
  selectedPath.value = path
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden">
    <Tabs default-value="editor" class="flex h-full min-h-0 flex-col overflow-hidden">
      <TabsList class="mx-2 mt-2 w-fit shrink-0">
        <TabsTrigger value="editor">
          Editor
        </TabsTrigger>
        <TabsTrigger value="changes">
          Changes
        </TabsTrigger>
      </TabsList>
      <TabsContent
        value="editor"
        class="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden"
      >
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
              <WorkbenchMonacoEditor :path="selectedPath" />
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
              :selected-path="selectedPath"
              @select="handleSelect"
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </TabsContent>
      <TabsContent
        value="changes"
        class="mt-0 min-h-0 flex-1 overflow-y-auto p-4 text-sm text-muted-foreground"
      >
        Git changes will appear here after agent edits.
      </TabsContent>
    </Tabs>
  </div>
</template>
