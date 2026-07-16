<script setup lang="ts">
import { FileTreeFile } from '@/components/ai-elements/file-tree'
import WorkbenchFileEntryIcon from '@/components/workbench/FileEntryIcon.vue'
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
  <FileTreeFile
    v-else
    :path="node.path"
    :name="node.name"
  >
    <template #default>
      <WorkbenchFileEntryIcon :name="node.name" />
      <span class="truncate">{{ node.name }}</span>
    </template>
  </FileTreeFile>
</template>
