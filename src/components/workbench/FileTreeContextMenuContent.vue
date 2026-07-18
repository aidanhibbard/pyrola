<script setup lang="ts">
import {
  ClipboardCopy,
  ClipboardPaste,
  Copy,
  File,
  FilePlus,
  FolderOpen,
  MessageSquarePlus,
  Pencil,
  Scissors,
  Terminal,
  Trash2,
} from '@lucide/vue'
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
  clipboard,
  copyRelativePath,
  copyAbsolutePath,
  copyName,
  revealInFinder,
  openInEditor,
  handleRename,
  handleDelete,
  handleCut,
  handleCopy,
  handlePaste,
  handleAddFileToChat,
  handleAddFileToNewChat,
  handleOpenInTerminal,
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

const handleRenameSelect = (): void => {
  handleRename(props.path)
}

const handleDeleteSelect = (): void => {
  handleDelete(props.path, props.isDirectory)
}

const handleCutSelect = (): void => {
  handleCut(props.path)
}

const handleCopySelect = (): void => {
  handleCopy(props.path)
}

const handlePasteSelect = async (): Promise<void> => {
  await handlePaste(props.path)
}

const handleAddFileToChatSelect = (): void => {
  handleAddFileToChat(props.path)
}

const handleAddFileToNewChatSelect = async (): Promise<void> => {
  await handleAddFileToNewChat(props.path)
}

const handleOpenInTerminalSelect = async (): Promise<void> => {
  await handleOpenInTerminal(props.path, props.isDirectory)
}
</script>

<template>
  <ContextMenuContent class="w-56">
    <ContextMenuLabel>{{ name }}</ContextMenuLabel>
    <ContextMenuSeparator />
    <ContextMenuItem @select="handleRenameSelect">
      <Pencil />
      Rename
    </ContextMenuItem>
    <ContextMenuItem
      variant="destructive"
      @select="handleDeleteSelect"
    >
      <Trash2 />
      Delete
    </ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem @select="handleCutSelect">
      <Scissors />
      Cut
    </ContextMenuItem>
    <ContextMenuItem @select="handleCopySelect">
      <ClipboardCopy />
      Copy
    </ContextMenuItem>
    <ContextMenuItem
      v-if="isDirectory"
      :disabled="!clipboard.hasClipboard.value"
      @select="handlePasteSelect"
    >
      <ClipboardPaste />
      Paste
    </ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem
      v-if="!isDirectory"
      @select="handleAddFileToChatSelect"
    >
      <File />
      Add file to chat
    </ContextMenuItem>
    <ContextMenuItem
      v-if="!isDirectory"
      @select="handleAddFileToNewChatSelect"
    >
      <MessageSquarePlus />
      Add file to new chat
    </ContextMenuItem>
    <ContextMenuItem @select="handleOpenInTerminalSelect">
      <Terminal />
      Open in terminal
    </ContextMenuItem>
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
      <FilePlus />
      Open in editor
    </ContextMenuItem>
  </ContextMenuContent>
</template>
