<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AcceptableValue } from 'reka-ui'
import { Code, Columns2, Eye, X } from '@lucide/vue'
import { toast } from 'vue-sonner'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/shadcn/ui/alert-dialog'
import { Button } from '@/components/shadcn/ui/button'
import { ScrollArea, ScrollBar } from '@/components/shadcn/ui/scroll-area'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/shadcn/ui/resizable'
import { ToggleGroup, ToggleGroupItem } from '@/components/shadcn/ui/toggle-group'
import WorkbenchEditorMarkdownPreview from '@/components/workbench/EditorMarkdownPreview.vue'
import WorkbenchFileTree from '@/components/workbench/FileTree.vue'
import WorkbenchMonacoEditor from '@/components/workbench/MonacoEditor.vue'
import useWorkbenchStore from '@/composables/use-workbench-store'
import { fsReadFile } from '@/services/pyrola/pyrola-tauri'
import type { EditorPayload, WorkbenchTab } from '@/types/workbench/workbench-tab'

type EditorMode = 'edit' | 'split' | 'preview'

const props = defineProps<{
  tab: WorkbenchTab
}>()

const workbench = useWorkbenchStore()

const monacoRef = ref<InstanceType<typeof WorkbenchMonacoEditor> | null>(null)
const editorMode = ref<EditorMode>('edit')
const fileContent = ref('')
const fileDirty = ref<Record<string, boolean>>({})
const closeConfirmOpen = ref(false)
const closeTargetPath = ref<string | null>(null)
const closeSaving = ref(false)

const editorPayload = computed(() => props.tab.payload as EditorPayload)

const openPaths = computed(() => {
  const payload = editorPayload.value
  if (payload.openPaths.length > 0) {
    return payload.openPaths
  }
  return payload.path ? [payload.path] : []
})

const selectedPath = computed(() => editorPayload.value.path)
const projectRoot = computed(() => workbench.getProject(props.tab.projectId)?.rootPath ?? null)

const isMarkdownFile = computed(() => {
  const path = selectedPath.value
  return path.endsWith('.md') || path.endsWith('.markdown')
})

const showPreview = computed(() => isMarkdownFile.value && editorMode.value !== 'edit')
const showEditor = computed(() => !isMarkdownFile.value || editorMode.value !== 'preview')

const fileName = (path: string): string => path.split('/').pop() ?? path

const syncWorkbenchDirty = (): void => {
  const anyDirty = Object.values(fileDirty.value).some(Boolean)
  workbench.setEditorTabDirty(props.tab.id, anyDirty)
}

const handleSelect = (path: string): void => {
  workbench.openEditor(props.tab.projectId, path)
}

const handleSubTabClick = (path: string): void => {
  if (path === selectedPath.value) {
    return
  }
  workbench.setEditorActivePath(props.tab.id, path)
}

const removeDirtyPath = (path: string): void => {
  const next = { ...fileDirty.value }
  delete next[path]
  fileDirty.value = next
  syncWorkbenchDirty()
}

const handleSubTabClose = (path: string): void => {
  if (fileDirty.value[path]) {
    closeTargetPath.value = path
    closeConfirmOpen.value = true
    return
  }
  workbench.closeEditorFile(props.tab.id, path).catch((error) => {
    toast.error('Failed to close file', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  })
}

const handleCloseConfirmOpenChange = (open: boolean): void => {
  closeConfirmOpen.value = open
  if (!open) {
    closeTargetPath.value = null
  }
}

const handleDiscardClose = async (): Promise<void> => {
  const path = closeTargetPath.value
  if (!path) {
    return
  }
  closeConfirmOpen.value = false
  closeTargetPath.value = null
  removeDirtyPath(path)
  try {
    await workbench.closeEditorFile(props.tab.id, path)
  } catch (error) {
    toast.error('Failed to close file', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const handleSaveAndClose = async (): Promise<void> => {
  const path = closeTargetPath.value
  if (!path) {
    return
  }

  if (path !== selectedPath.value) {
    workbench.setEditorActivePath(props.tab.id, path)
  }

  closeSaving.value = true
  try {
    const saved = await monacoRef.value?.save(path)
    if (!saved) {
      return
    }
    removeDirtyPath(path)
    closeConfirmOpen.value = false
    closeTargetPath.value = null
    await workbench.closeEditorFile(props.tab.id, path)
  } catch (error) {
    toast.error('Failed to save file', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    closeSaving.value = false
  }
}

const handleDirtyChange = (payload: { path: string; dirty: boolean }): void => {
  fileDirty.value = { ...fileDirty.value, [payload.path]: payload.dirty }
  syncWorkbenchDirty()
}

const handleSaved = (payload: { path: string; content: string }): void => {
  if (payload.path === selectedPath.value && isMarkdownFile.value) {
    fileContent.value = payload.content
  }
}

const handleEditorModeChange = (value: AcceptableValue | AcceptableValue[]): void => {
  if (typeof value !== 'string') {
    return
  }
  if (value === 'edit' || value === 'split' || value === 'preview') {
    editorMode.value = value
  }
}

const loadFileContent = async (): Promise<void> => {
  const root = projectRoot.value
  const path = selectedPath.value
  if (!root || !path || !isMarkdownFile.value) {
    fileContent.value = ''
    return
  }

  try {
    const result = await fsReadFile({ projectRoot: root, path })
    fileContent.value = result.content
  } catch (error) {
    fileContent.value = ''
    toast.error('Failed to load preview', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

watch(selectedPath, (path) => {
  if (!path.endsWith('.md') && !path.endsWith('.markdown')) {
    editorMode.value = 'edit'
  }
})

watch(
  [selectedPath, projectRoot, isMarkdownFile],
  () => {
    loadFileContent().catch((error) => {
      toast.error('Failed to load preview', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    })
  },
  { immediate: true },
)
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
      <div class="flex h-full min-h-0 flex-col overflow-hidden">
        <ScrollArea class="w-full shrink-0 border-b border-border/50">
          <div class="flex items-center gap-0.5 px-1 py-1">
            <button
              v-for="filePath in openPaths"
              :key="filePath"
              type="button"
              class="group flex max-w-[12rem] shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors"
              :class="
                filePath === selectedPath
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              "
              @click="handleSubTabClick(filePath)"
            >
              <span
                v-if="fileDirty[filePath]"
                class="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                aria-label="Unsaved changes"
              />
              <span class="truncate">{{ fileName(filePath) }}</span>
              <span
                role="button"
                tabindex="0"
                class="ml-0.5 shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-background/80 group-hover:opacity-100"
                :class="filePath === selectedPath ? 'opacity-70' : ''"
                aria-label="Close file"
                @click.stop="handleSubTabClose(filePath)"
                @keydown.enter.stop="handleSubTabClose(filePath)"
                @keydown.space.prevent.stop="handleSubTabClose(filePath)"
              >
                <X class="h-3 w-3" />
              </span>
            </button>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <div
          v-if="isMarkdownFile"
          class="flex shrink-0 items-center justify-end border-b border-border/50 px-2 py-1"
        >
          <ToggleGroup
            type="single"
            :model-value="editorMode"
            variant="outline"
            size="sm"
            @update:model-value="handleEditorModeChange"
          >
            <ToggleGroupItem value="edit" aria-label="Edit">
              <Code class="h-3.5 w-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem value="split" aria-label="Split">
              <Columns2 class="h-3.5 w-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem value="preview" aria-label="Preview">
              <Eye class="h-3.5 w-3.5" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div
          class="flex min-h-0 flex-1 overflow-hidden"
          :class="editorMode === 'split' ? 'flex-row' : 'flex-col'"
        >
          <div
            v-show="showEditor"
            class="min-h-0 min-w-0 overflow-hidden"
            :class="editorMode === 'split' ? 'flex-1' : 'h-full w-full'"
          >
            <WorkbenchMonacoEditor
              ref="monacoRef"
              :project-id="tab.projectId"
              :path="selectedPath"
              :open-paths="openPaths"
              @dirty-change="handleDirtyChange"
              @saved="handleSaved"
            />
          </div>

          <div
            v-if="editorMode === 'split'"
            class="w-px shrink-0 bg-border"
            aria-hidden="true"
          />

          <div
            v-if="showPreview"
            class="min-h-0 min-w-0 overflow-hidden"
            :class="editorMode === 'split' ? 'flex-1' : 'h-full w-full'"
          >
            <WorkbenchEditorMarkdownPreview
              :key="selectedPath"
              :path="selectedPath"
              :project-root="projectRoot"
              :content="fileContent"
            />
          </div>
        </div>
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

  <AlertDialog
    :open="closeConfirmOpen"
    @update:open="handleCloseConfirmOpenChange"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Save before closing?</AlertDialogTitle>
        <AlertDialogDescription>
          <template v-if="closeTargetPath">
            "{{ fileName(closeTargetPath) }}" has unsaved changes.
          </template>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <Button
          variant="outline"
          :disabled="closeSaving"
          @click="handleDiscardClose"
        >
          Discard
        </Button>
        <Button
          :disabled="closeSaving"
          @click="handleSaveAndClose"
        >
          Save
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
