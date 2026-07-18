<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  ChevronLeft,
  ChevronRight,
  FileCode,
  List,
  MoreHorizontal,
  Search,
  X,
} from '@lucide/vue'
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/shadcn/ui/dropdown-menu'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/shadcn/ui/empty'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/shadcn/ui/resizable'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/shadcn/ui/tooltip'
import WorkbenchEditorMarkdownPreview from '@/components/workbench/EditorMarkdownPreview.vue'
import WorkbenchFileTree from '@/components/workbench/FileTree.vue'
import WorkbenchMonacoEditor from '@/components/workbench/MonacoEditor.vue'
import useCommandPalette from '@/composables/use-command-palette'
import useWorkbenchStore from '@/composables/use-workbench-store'
import { fsReadFile, revealInFolder } from '@/services/pyrola/pyrola-tauri'
import type { EditorPayload, WorkbenchTab } from '@/types/workbench/workbench-tab'

type EditorMode = 'edit' | 'preview'

const props = defineProps<{
  tab: WorkbenchTab
}>()

const workbench = useWorkbenchStore()
const commandPalette = useCommandPalette()

const monacoRef = ref<InstanceType<typeof WorkbenchMonacoEditor> | null>(null)
const editorMode = ref<EditorMode>('edit')
const fileContent = ref('')
const fileDirty = ref<Record<string, boolean>>({})
const closeConfirmOpen = ref(false)
const closeTargetPath = ref<string | null>(null)
const closeSaving = ref(false)
const fileTreeOpen = ref(true)
const isNavigatingHistory = ref(false)
const pathHistory = ref<string[]>([])
const historyIndex = ref(-1)

const diffView = ref(false)
const lspEnabled = ref(true)
const lineNumbers = ref(true)
const wordWrap = ref(true)
const autoSave = ref(false)
const formatOnSave = ref(false)

const editorPayload = computed(() => props.tab.payload as EditorPayload)

const openPaths = computed(() => {
  const payload = editorPayload.value
  if (payload.openPaths.length > 0) {
    return payload.openPaths
  }
  return payload.path ? [payload.path] : []
})

const selectedPath = computed(() => editorPayload.value.path)
const isEmpty = computed(() => openPaths.value.length === 0)
const projectRoot = computed(() => workbench.getProject(props.tab.projectId)?.rootPath ?? null)

const isMarkdownFile = computed(() => {
  const path = selectedPath.value
  return path.endsWith('.md') || path.endsWith('.markdown')
})

const showPreview = computed(() => isMarkdownFile.value && editorMode.value === 'preview')
const showEditor = computed(() => !isMarkdownFile.value || editorMode.value === 'edit')

const activeFileName = computed(() => {
  const path = selectedPath.value
  if (!path) {
    return ''
  }
  return fileName(path)
})

const canGoBack = computed(() => historyIndex.value > 0)
const canGoForward = computed(() => historyIndex.value < pathHistory.value.length - 1)

const fileName = (path: string): string => path.split('/').pop() ?? path

const toAbsolutePath = (relativePath: string): string => {
  const root = projectRoot.value
  if (!root) {
    return ''
  }
  if (relativePath === '.' || relativePath === '') {
    return root
  }
  return `${root.replace(/\/$/, '')}/${relativePath}`
}

const parentDirectoryPath = (absolutePath: string): string => {
  const lastSlash = absolutePath.lastIndexOf('/')
  if (lastSlash <= 0) {
    return absolutePath
  }
  return absolutePath.slice(0, lastSlash)
}

const pushPathHistory = (path: string): void => {
  if (!path) {
    return
  }

  const truncated = pathHistory.value.slice(0, historyIndex.value + 1)
  if (truncated[truncated.length - 1] === path) {
    return
  }

  truncated.push(path)
  pathHistory.value = truncated
  historyIndex.value = truncated.length - 1
}

const syncWorkbenchDirty = (): void => {
  const anyDirty = Object.values(fileDirty.value).some(Boolean)
  workbench.setEditorTabDirty(props.tab.id, anyDirty)
}

const handleSelect = (path: string): void => {
  workbench.openEditor(props.tab.projectId, path)
}

const handleOpenSearch = (): void => {
  commandPalette.openPalette()
}

const handleToggleFileTree = (): void => {
  fileTreeOpen.value = !fileTreeOpen.value
}

const handleBack = (): void => {
  if (!canGoBack.value) {
    return
  }

  const nextIndex = historyIndex.value - 1
  const path = pathHistory.value[nextIndex]
  if (!path) {
    return
  }

  historyIndex.value = nextIndex
  isNavigatingHistory.value = true
  workbench.setEditorActivePath(props.tab.id, path)
  isNavigatingHistory.value = false
}

const handleForward = (): void => {
  if (!canGoForward.value) {
    return
  }

  const nextIndex = historyIndex.value + 1
  const path = pathHistory.value[nextIndex]
  if (!path) {
    return
  }

  historyIndex.value = nextIndex
  isNavigatingHistory.value = true
  workbench.setEditorActivePath(props.tab.id, path)
  isNavigatingHistory.value = false
}

const handleSave = async (): Promise<void> => {
  try {
    await monacoRef.value?.save()
  } catch (error) {
    toast.error('Failed to save file', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const handleRevealInFinder = async (): Promise<void> => {
  const path = selectedPath.value
  if (!path) {
    return
  }

  const absolutePath = toAbsolutePath(path)
  const revealPath = parentDirectoryPath(absolutePath)

  try {
    await revealInFolder(revealPath)
  } catch (error) {
    toast.error('Failed to reveal in Finder', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const handleCopyRelativePath = async (): Promise<void> => {
  const path = selectedPath.value
  if (!path) {
    return
  }

  try {
    await navigator.clipboard.writeText(path)
  } catch (error) {
    toast.error('Failed to copy relative path', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
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
  selectedPath,
  (path) => {
    if (isNavigatingHistory.value || !path) {
      return
    }
    pushPathHistory(path)
  },
  { immediate: true },
)

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
        <div
          v-if="!isEmpty"
          class="group flex h-7 shrink-0 items-center justify-between border-b border-border/50 px-2"
        >
          <div class="flex min-w-0 flex-1 items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-6 w-6 shrink-0 text-muted-foreground"
                  :disabled="!canGoBack"
                  aria-label="Go back"
                  @click="handleBack"
                >
                  <ChevronLeft class="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Go back</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-6 w-6 shrink-0 text-muted-foreground"
                  :disabled="!canGoForward"
                  aria-label="Go forward"
                  @click="handleForward"
                >
                  <ChevronRight class="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Go forward</TooltipContent>
            </Tooltip>
            <span
              v-if="fileDirty[selectedPath]"
              class="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
              aria-label="Unsaved changes"
            />
            <span class="truncate text-xs text-muted-foreground">
              {{ activeFileName }}
            </span>
            <Button
              variant="ghost"
              size="icon"
              class="h-5 w-5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="Close file"
              @click="handleSubTabClose(selectedPath)"
            >
              <X class="h-3 w-3" />
            </Button>
          </div>

          <div
            v-if="!fileTreeOpen || isMarkdownFile"
            class="flex shrink-0 items-center gap-0.5"
          >
            <template v-if="isMarkdownFile">
              <Button
                variant="ghost"
                size="sm"
                class="h-6 px-2 text-xs"
                :class="
                  editorMode === 'edit'
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                "
                @click="editorMode = 'edit'"
              >
                Source
              </Button>
              <Button
                variant="ghost"
                size="sm"
                class="h-6 px-2 text-xs"
                :class="
                  editorMode === 'preview'
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                "
                @click="editorMode = 'preview'"
              >
                Preview
              </Button>
            </template>

            <Tooltip v-if="!fileTreeOpen">
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-6 w-6 text-muted-foreground"
                  aria-label="Toggle file list"
                  @click="handleToggleFileTree"
                >
                  <List class="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle file list</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <Empty
          v-if="isEmpty"
          class="min-h-0 flex-1 border-none"
        >
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileCode />
            </EmptyMedia>
            <EmptyTitle>No file open</EmptyTitle>
            <EmptyDescription>
              Select a file from the tree or search the project.
            </EmptyDescription>
            <Button
              variant="ghost"
              size="sm"
              class="mt-2 text-muted-foreground"
              @click="handleOpenSearch"
            >
              <Search class="mr-2 h-3.5 w-3.5" />
              Search files
            </Button>
          </EmptyHeader>
        </Empty>

        <div
          v-else
          class="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div
            v-show="showEditor"
            class="h-full min-h-0 min-w-0 overflow-hidden"
          >
            <WorkbenchMonacoEditor
              ref="monacoRef"
              :project-id="tab.projectId"
              :path="selectedPath"
              :open-paths="openPaths"
              :lsp-enabled="lspEnabled"
              @dirty-change="handleDirtyChange"
              @saved="handleSaved"
            />
          </div>

          <div
            v-if="showPreview"
            class="h-full min-h-0 min-w-0 overflow-hidden"
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
    <ResizableHandle v-if="fileTreeOpen" />
    <ResizablePanel
      v-if="fileTreeOpen"
      :default-size="25"
      :min-size="15"
      :max-size="40"
      class="min-h-0 min-w-0 overflow-hidden"
    >
      <WorkbenchFileTree
        :project-id="tab.projectId"
        :selected-path="selectedPath"
        @select="handleSelect"
      >
        <template #toolbar>
          <div class="flex shrink-0 items-center gap-0.5">
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-6 w-6 text-muted-foreground"
                  aria-label="File actions"
                >
                  <MoreHorizontal class="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" class="w-56">
                <DropdownMenuLabel>File</DropdownMenuLabel>
                <DropdownMenuItem @click="handleSave">
                  Save
                  <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem @click="handleRevealInFinder">
                  Reveal in Finder
                </DropdownMenuItem>
                <DropdownMenuItem @click="handleCopyRelativePath">
                  Copy Relative Path
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>View</DropdownMenuLabel>
                <DropdownMenuCheckboxItem v-model:checked="diffView">
                  Diff View
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem v-model:checked="lspEnabled">
                  LSP
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem v-model:checked="lineNumbers">
                  Line Numbers
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem v-model:checked="wordWrap">
                  Word Wrap
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Editor</DropdownMenuLabel>
                <DropdownMenuCheckboxItem v-model:checked="autoSave">
                  Auto Save
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem v-model:checked="formatOnSave">
                  Format on Save
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-6 w-6 text-muted-foreground"
                  aria-label="Search files"
                  @click="handleOpenSearch"
                >
                  <Search class="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Search files</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-6 w-6 text-muted-foreground"
                  :class="fileTreeOpen ? 'text-foreground' : ''"
                  aria-label="Toggle file list"
                  @click="handleToggleFileTree"
                >
                  <List class="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle file list</TooltipContent>
            </Tooltip>
          </div>
        </template>
      </WorkbenchFileTree>
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
