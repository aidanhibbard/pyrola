<script setup lang="ts">
import { computed, onMounted, provide, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { FileTree } from '@/components/ai-elements/file-tree'
import { fsListDirTree } from '@/services/pyrola/pyrola-tauri'
import useFleetRegistry from '@/composables/use-fleet-registry'
import { FileTreeProjectRootKey } from '@/composables/use-file-tree-node-menu'
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

const projectLabel = computed(() => {
  const project = fleet.projects.value.find((p) => p.id === props.projectId)
  return project?.name ?? 'Project'
})

const projectRoot = computed(
  () => fleet.projects.value.find((p) => p.id === props.projectId)?.rootPath ?? null,
)

provide(FileTreeProjectRootKey, projectRoot)

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

const handleSelect = (path: string): void => {
  if (findNodeKind(tree.value?.children, path) === 'directory') {
    return
  }
  selectedPath.value = path
  emit('select', path)
}

const handleExpandedChange = (expanded: Set<string>): void => {
  expandedPaths.value = expanded
}

onMounted(() => {
  loadTree().catch((error) => {
    toast.error('Failed to load file tree', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  })
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
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden text-sm">
    <div class="border-b border-border/50 px-3 py-2 text-xs font-medium text-foreground">
      {{ projectLabel }}
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto p-2">
      <FileTree
        v-if="tree?.children"
        class="border-0 bg-transparent p-0"
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
        />
      </FileTree>
    </div>
  </div>
</template>
