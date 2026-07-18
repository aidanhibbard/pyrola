<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { FilePlus, FolderPlus, RefreshCw } from '@lucide/vue'
import { toast } from 'vue-sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/shadcn/ui/alert-dialog'
import { Button } from '@/components/shadcn/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/ui/dialog'
import { Input } from '@/components/shadcn/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/shadcn/ui/tooltip'
import { FileTree } from '@/components/ai-elements/file-tree'
import { fsDelete, fsListDirTree, fsMkdir, fsRename, fsWriteFile } from '@/services/pyrola/pyrola-tauri'
import useFleetRegistry from '@/composables/use-fleet-registry'
import {
  FileTreeProjectIdKey,
  FileTreeProjectRootKey,
  FileTreeRefreshKey,
  FileTreeStartDeleteKey,
  FileTreeStartRenameKey,
} from '@/composables/use-file-tree-node-menu'
import WorkbenchFileTreeNode from '@/components/workbench/FileTreeNode.vue'

const props = defineProps<{
  projectId: string
  selectedPath?: string | null
}>()

const emit = defineEmits<{
  select: [path: string]
}>()

type TreeNode = {
  name: string
  path: string
  kind: string
  children?: TreeNode[]
}

const fleet = useFleetRegistry()
const tree = ref<TreeNode | null>(null)
const expandedPaths = ref(new Set<string>(['.']))
const selectedPath = ref(props.selectedPath ?? '')
const renamingPath = ref<string | null>(null)
const deleteTarget = ref<{ path: string; isDirectory: boolean } | null>(null)
const deleting = ref(false)
const createDialogOpen = ref(false)
const createDialogMode = ref<'file' | 'folder'>('file')
const createName = ref('')
const creating = ref(false)

const projectLabel = computed(() => {
  const project = fleet.projects.value.find((p) => p.id === props.projectId)
  return project?.name ?? 'Project'
})

const projectRoot = computed(
  () => fleet.projects.value.find((p) => p.id === props.projectId)?.rootPath ?? null,
)

const projectIdRef = computed(() => props.projectId)

provide(FileTreeProjectRootKey, projectRoot)
provide(FileTreeProjectIdKey, projectIdRef)

const findNodeKind = (
  nodes: TreeNode[] | undefined,
  path: string,
): string | null => {
  if (!nodes) {
    return null
  }
  for (const node of nodes) {
    if (node.path === path) {
      return node.kind
    }
    const childKind = findNodeKind(node.children, path)
    if (childKind) {
      return childKind
    }
  }
  return null
}

const loadTree = async (): Promise<void> => {
  const root = projectRoot.value
  if (!root) {
    tree.value = null
    return
  }
  tree.value = (await fsListDirTree(root, '.', 4)) as TreeNode
}

const refresh = async (): Promise<void> => {
  try {
    await loadTree()
  } catch (error) {
    toast.error('Failed to refresh file tree', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

provide(FileTreeRefreshKey, refresh)

const startRename = (path: string): void => {
  renamingPath.value = path
}

const startDelete = (path: string, isDirectory: boolean): void => {
  deleteTarget.value = { path, isDirectory }
}

provide(FileTreeStartRenameKey, startRename)
provide(FileTreeStartDeleteKey, startDelete)

const parentPath = (path: string): string => {
  const segments = path.split('/').filter(Boolean)
  if (segments.length <= 1) {
    return '.'
  }
  return segments.slice(0, -1).join('/')
}

const joinPath = (directory: string, name: string): string => {
  if (directory === '.' || directory === '') {
    return name
  }
  return `${directory}/${name}`
}

const handleRenameConfirm = async (path: string, nextName: string): Promise<void> => {
  const root = projectRoot.value
  if (!root) {
    toast.error('Project root is unavailable')
    return
  }

  const trimmed = nextName.trim()
  if (!trimmed || trimmed === path.split('/').pop()) {
    renamingPath.value = null
    return
  }

  const destination = joinPath(parentPath(path), trimmed)

  try {
    await fsRename({
      projectRoot: root,
      from: path,
      to: destination,
    })
    renamingPath.value = null
    await refresh()
  } catch (error) {
    toast.error('Failed to rename', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const handleRenameCancel = (): void => {
  renamingPath.value = null
}

const handleDeleteConfirm = async (): Promise<void> => {
  const root = projectRoot.value
  const target = deleteTarget.value
  if (!root || !target) {
    return
  }

  deleting.value = true
  try {
    await fsDelete({
      projectRoot: root,
      path: target.path,
      recursive: target.isDirectory,
    })
    deleteTarget.value = null
    await refresh()
  } catch (error) {
    toast.error('Failed to delete', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    deleting.value = false
  }
}

const handleDeleteOpenChange = (open: boolean): void => {
  if (!open) {
    deleteTarget.value = null
  }
}

const createParentPath = computed((): string => {
  const path = selectedPath.value
  if (!path) {
    return '.'
  }
  const kind = findNodeKind(tree.value?.children, path)
  if (kind === 'directory') {
    return path
  }
  return parentPath(path)
})

const handleCreateDialogOpenChange = (open: boolean): void => {
  createDialogOpen.value = open
  if (!open) {
    createName.value = ''
    creating.value = false
  }
}

const handleNewFile = (): void => {
  createDialogMode.value = 'file'
  createName.value = ''
  createDialogOpen.value = true
}

const handleNewFolder = (): void => {
  createDialogMode.value = 'folder'
  createName.value = ''
  createDialogOpen.value = true
}

const handleCreateConfirm = async (): Promise<void> => {
  const root = projectRoot.value
  const name = createName.value.trim()
  if (!root) {
    toast.error('Project root is unavailable')
    return
  }
  if (!name) {
    return
  }

  const destination = joinPath(createParentPath.value, name)
  const mode = createDialogMode.value
  creating.value = true
  try {
    if (mode === 'folder') {
      await fsMkdir({ projectRoot: root, path: destination })
    } else {
      await fsWriteFile({ projectRoot: root, path: destination, content: '' })
    }
    createDialogOpen.value = false
    createName.value = ''
    await refresh()
    if (mode === 'file') {
      emit('select', destination)
    }
  } catch (error) {
    toast.error(
      mode === 'folder' ? 'Failed to create folder' : 'Failed to create file',
      {
        description: error instanceof Error ? error.message : 'Unknown error',
      },
    )
  } finally {
    creating.value = false
  }
}

const handleRefresh = async (): Promise<void> => {
  await refresh()
}

const handleSelect = (path: string): void => {
  if (renamingPath.value) {
    handleRenameCancel()
  }
  if (findNodeKind(tree.value?.children, path) === 'directory') {
    return
  }
  selectedPath.value = path
  emit('select', path)
}

const handleExpandedChange = (expanded: Set<string>): void => {
  expandedPaths.value = expanded
}

const handlePointerDownOutsideRename = (event: PointerEvent): void => {
  if (!renamingPath.value) {
    return
  }
  const target = event.target
  if (target instanceof Element && target.closest('[data-rename-input]')) {
    return
  }
  handleRenameCancel()
}

onMounted(() => {
  document.addEventListener('pointerdown', handlePointerDownOutsideRename)
  loadTree().catch((error) => {
    toast.error('Failed to load file tree', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  })
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', handlePointerDownOutsideRename)
})

watch(
  projectRoot,
  () => {
    loadTree().catch((error) => {
      toast.error('Failed to load file tree', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    })
  },
)

watch(
  () => props.selectedPath,
  (path) => {
    if (path) {
      selectedPath.value = path
    }
  },
)

defineExpose({
  refresh,
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden font-sans text-[13px]">
    <div class="flex h-7 shrink-0 items-center justify-end border-b border-border/20 px-2">
      <slot name="toolbar" />
    </div>
    <div class="flex items-center justify-between px-2 py-1">
      <span class="truncate text-[13px] font-medium text-foreground">
        {{ projectLabel }}
      </span>
      <div class="flex shrink-0 items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-6 w-6 text-muted-foreground"
              aria-label="New file"
              @click="handleNewFile"
            >
              <FilePlus class="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New file</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-6 w-6 text-muted-foreground"
              aria-label="New folder"
              @click="handleNewFolder"
            >
              <FolderPlus class="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New folder</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-6 w-6 text-muted-foreground"
              aria-label="Refresh"
              @click="handleRefresh"
            >
              <RefreshCw class="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh</TooltipContent>
        </Tooltip>
      </div>
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
      <FileTree
        v-if="tree?.children"
        unstyled
        class="border-0 bg-transparent p-0 font-sans text-[13px]"
        :expanded="expandedPaths"
        :selected-path="selectedPath"
        :default-expanded="expandedPaths"
        @update:selected-path="handleSelect"
        @expanded-change="handleExpandedChange"
      >
        <WorkbenchFileTreeNode
          v-for="child in tree.children"
          :key="child.path"
          :node="child"
          :renaming-path="renamingPath"
          @rename-confirm="handleRenameConfirm"
          @rename-cancel="handleRenameCancel"
        />
      </FileTree>
    </div>

    <Dialog
      :open="createDialogOpen"
      @update:open="handleCreateDialogOpenChange"
    >
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {{ createDialogMode === 'folder' ? 'New folder' : 'New file' }}
          </DialogTitle>
          <DialogDescription>
            Enter a name for the new {{ createDialogMode === 'folder' ? 'folder' : 'file' }}.
          </DialogDescription>
        </DialogHeader>
        <Input
          v-model="createName"
          :placeholder="createDialogMode === 'folder' ? 'folder-name' : 'file-name.ts'"
          @keydown.enter="handleCreateConfirm"
        />
        <DialogFooter>
          <Button
            variant="outline"
            :disabled="creating"
            @click="handleCreateDialogOpenChange(false)"
          >
            Cancel
          </Button>
          <Button
            :disabled="creating || !createName.trim()"
            @click="handleCreateConfirm"
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog
      :open="deleteTarget !== null"
      @update:open="handleDeleteOpenChange"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {{ deleteTarget?.isDirectory ? 'folder' : 'file' }}?</AlertDialogTitle>
          <AlertDialogDescription>
            <template v-if="deleteTarget?.isDirectory">
              This will permanently delete "{{ deleteTarget.path }}" and all of its contents.
            </template>
            <template v-else>
              This will permanently delete "{{ deleteTarget?.path }}".
            </template>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="deleting">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            :disabled="deleting"
            @click="handleDeleteConfirm"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
