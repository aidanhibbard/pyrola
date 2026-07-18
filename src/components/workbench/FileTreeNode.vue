<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  ContextMenu,
  ContextMenuTrigger,
} from '@/components/shadcn/ui/context-menu'
import { Input } from '@/components/shadcn/ui/input'
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

const props = defineProps<{
  node: TreeNode
  renamingPath?: string | null
}>()

const emit = defineEmits<{
  renameConfirm: [path: string, nextName: string]
  renameCancel: []
}>()

const renameInputRef = ref<HTMLInputElement | null>(null)
const renameValue = ref('')

const isRenaming = computed(() => props.renamingPath === props.node.path)

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
  if (isRenaming.value) {
    emit('renameConfirm', props.node.path, renameValue.value)
  }
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
      >
        <template #default>
          <WorkbenchFileEntryIcon :name="node.name" />
          <Input
            v-if="isRenaming"
            ref="renameInputRef"
            v-model="renameValue"
            class="h-6 min-w-0 flex-1 px-1 py-0 text-sm"
            @keydown="handleRenameKeydown"
            @blur="handleRenameBlur"
            @click.stop
          />
          <span
            v-else
            class="truncate"
          >{{ node.name }}</span>
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
