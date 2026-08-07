<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue'
import {
  ContextMenu,
  ContextMenuTrigger,
} from '@/components/shadcn/ui/context-menu'
import { Input } from '@/components/shadcn/ui/input'
import { FileTreeActions, FileTreeFile } from '@/components/ai-elements/file-tree'
import WorkbenchFileEntryIcon from '@/components/workbench/FileEntryIcon.vue'
import WorkbenchFileTreeContextMenuContent from '@/components/workbench/FileTreeContextMenuContent.vue'
import WorkbenchFileTreeFolder from '@/components/workbench/FileTreeFolder.vue'
import WorkbenchFileTreeGitLetter from '@/components/workbench/FileTreeGitLetter.vue'
import WorkbenchFileTreeNode from '@/components/workbench/FileTreeNode.vue'
import { FileTreeGitDecorationKey } from '@/composables/use-git-status'
import { cn } from '@/lib/utils'
import {
  decorationNameClass,
  hasDecorationLetter,
  resolvePathDecoration,
} from '@/utils/git-file-decoration'

type TreeNode = {
  name: string
  path: string
  kind: string
  children?: TreeNode[]
}

const props = defineProps<{
  node: TreeNode
  renamingPath?: string | null
}>()

const emit = defineEmits<{
  renameConfirm: [path: string, nextName: string]
  renameCancel: []
}>()

const gitDecorations = inject(FileTreeGitDecorationKey, null)

const renameInputRef = ref<HTMLInputElement | null>(null)
const renameValue = ref('')

const isRenaming = computed(() => props.renamingPath === props.node.path)

const fileDecoration = computed(() => {
  if (!gitDecorations) {
    return null
  }
  return resolvePathDecoration(
    props.node.path,
    gitDecorations.byPath.value,
    gitDecorations.folderByPath.value,
    gitDecorations.ignoredRoots.value,
    'file',
  )
})

const nameClass = computed(() => {
  const decoration = fileDecoration.value
  if (!decoration) {
    return 'min-w-0 flex-1 truncate font-sans text-[13px]'
  }
  return cn(
    'min-w-0 flex-1 truncate font-sans text-[13px] font-medium',
    decorationNameClass(decoration),
  )
})

const focusRenameInput = async (): Promise<void> => {
  await nextTick()
  const element = renameInputRef.value
  if (element instanceof HTMLInputElement) {
    element.focus()
    element.select()
    return
  }
  const root = (element as { $el?: unknown } | null)?.$el
  if (root instanceof HTMLInputElement) {
    root.focus()
    root.select()
  }
}

watch(
  () => props.renamingPath,
  async (path) => {
    if (path === props.node.path) {
      renameValue.value = props.node.name
      await focusRenameInput()
    }
  },
)

const handleRenameKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Enter') {
    event.preventDefault()
    emit('renameConfirm', props.node.path, renameValue.value)
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('renameCancel')
  }
}

const handleRenameBlur = (): void => {
  if (!isRenaming.value) {
    return
  }
  const trimmed = renameValue.value.trim()
  if (!trimmed || trimmed === props.node.name) {
    emit('renameCancel')
    return
  }
  emit('renameConfirm', props.node.path, renameValue.value)
}
</script>

<template>
  <WorkbenchFileTreeFolder
    v-if="node.kind === 'directory'"
    :path="node.path"
    :name="node.name"
    :renaming-path="renamingPath"
    @rename-confirm="(path, nextName) => emit('renameConfirm', path, nextName)"
    @rename-cancel="emit('renameCancel')"
  >
    <WorkbenchFileTreeNode
      v-for="child in node.children ?? []"
      :key="child.path"
      :node="child"
      :renaming-path="renamingPath"
      @rename-confirm="(path, nextName) => emit('renameConfirm', path, nextName)"
      @rename-cancel="emit('renameCancel')"
    />
  </WorkbenchFileTreeFolder>
  <ContextMenu v-else>
    <ContextMenuTrigger as-child>
      <FileTreeFile
        :path="node.path"
        :name="node.name"
        :data-path="node.path"
        :class="
          cn(
            'font-sans text-[13px]',
            fileDecoration === 'ignored' && 'opacity-50',
          )
        "
      >
        <template #default>
          <WorkbenchFileEntryIcon :name="node.name" />
          <Input
            v-if="isRenaming"
            ref="renameInputRef"
            v-model="renameValue"
            data-rename-input
            class="h-6 min-w-0 flex-1 px-1 py-0 text-sm"
            @keydown="handleRenameKeydown"
            @blur="handleRenameBlur"
            @click.stop
          />
          <span
            v-else
            :class="nameClass"
          >{{ node.name }}</span>
          <FileTreeActions
            v-if="fileDecoration && hasDecorationLetter(fileDecoration) && !isRenaming"
          >
            <WorkbenchFileTreeGitLetter :status="fileDecoration" />
          </FileTreeActions>
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
