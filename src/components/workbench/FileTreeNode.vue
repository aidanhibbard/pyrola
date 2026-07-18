<script setup lang="ts">
import {
  ContextMenu,
  ContextMenuTrigger,
} from '@/components/shadcn/ui/context-menu'
import { FileTreeFile } from '@/components/ai-elements/file-tree'
import WorkbenchFileEntryIcon from '@/components/workbench/FileEntryIcon.vue'
import WorkbenchFileTreeContextMenuContent from '@/components/workbench/FileTreeContextMenuContent.vue'
import WorkbenchFileTreeFolder from '@/components/workbench/FileTreeFolder.vue'
import WorkbenchFileTreeNode from '@/components/workbench/FileTreeNode.vue'

type TreeNode = {
  name: string
  path: string
  kind: string
  children?: TreeNode[]
}

defineProps<{
  node: TreeNode
}>()
</script>

<template>
  <WorkbenchFileTreeFolder
    v-if="node.kind === 'directory'"
    :path="node.path"
    :name="node.name"
  >
    <WorkbenchFileTreeNode
      v-for="child in node.children ?? []"
      :key="child.path"
      :node="child"
    />
  </WorkbenchFileTreeFolder>
  <ContextMenu v-else>
    <ContextMenuTrigger as-child>
      <FileTreeFile
        :path="node.path"
        :name="node.name"
      >
        <template #default>
          <WorkbenchFileEntryIcon :name="node.name" />
          <span class="truncate">{{ node.name }}</span>
        </template>
      </FileTreeFile>
    </ContextMenuTrigger>
    <WorkbenchFileTreeContextMenuContent
      :name="node.name"
      :path="node.path"
      :is-directory="false"
    />
  </ContextMenu>
</template>
