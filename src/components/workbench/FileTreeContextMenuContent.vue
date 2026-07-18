<script setup lang="ts">
import { Copy, File, FolderOpen } from '@lucide/vue'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
} from '@/components/shadcn/ui/context-menu'
import useFileTreeNodeMenu from '@/composables/use-file-tree-node-menu'

const props = defineProps<{
  name: string
  path: string
  isDirectory: boolean
}>()

const {
  copyRelativePath,
  copyAbsolutePath,
  copyName,
  revealInFinder,
  openInEditor,
} = useFileTreeNodeMenu()

const handleCopyRelativePath = async (): Promise<void> => {
  await copyRelativePath(props.path)
}

const handleCopyAbsolutePath = async (): Promise<void> => {
  await copyAbsolutePath(props.path)
}

const handleCopyName = async (): Promise<void> => {
  await copyName(props.name)
}

const handleRevealInFinder = async (): Promise<void> => {
  await revealInFinder(props.path, props.isDirectory)
}

const handleOpenInEditor = (): void => {
  openInEditor(props.path)
}
</script>

<template>
  <ContextMenuContent class="w-56">
    <ContextMenuLabel>{{ name }}</ContextMenuLabel>
    <ContextMenuSeparator />
    <ContextMenuItem @select="handleCopyRelativePath">
      <Copy />
      Copy relative path
    </ContextMenuItem>
    <ContextMenuItem @select="handleCopyAbsolutePath">
      <Copy />
      Copy path
    </ContextMenuItem>
    <ContextMenuItem @select="handleCopyName">
      <Copy />
      Copy name
    </ContextMenuItem>
    <ContextMenuItem @select="handleRevealInFinder">
      <FolderOpen />
      Reveal in Finder
    </ContextMenuItem>
    <ContextMenuItem
      v-if="!isDirectory"
      @select="handleOpenInEditor"
    >
      <File />
      Open in editor
    </ContextMenuItem>
  </ContextMenuContent>
</template>
