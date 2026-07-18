<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { ChevronRightIcon } from '@lucide/vue'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  ContextMenu,
  ContextMenuTrigger,
} from '@/components/shadcn/ui/context-menu'
import { Input } from '@/components/shadcn/ui/input'
import { cn } from '@/lib/utils'
import { computed, nextTick, provide, ref, watch } from 'vue'
import { FileTreeFolderKey, useFileTreeContext } from '@/components/ai-elements/file-tree/context'
import FileTreeIcon from '@/components/ai-elements/file-tree/FileTreeIcon.vue'
import FileTreeName from '@/components/ai-elements/file-tree/FileTreeName.vue'
import WorkbenchFileEntryIcon from '@/components/workbench/FileEntryIcon.vue'
import WorkbenchFileTreeContextMenuContent from '@/components/workbench/FileTreeContextMenuContent.vue'

interface Props extends /* @vue-ignore */ HTMLAttributes {
  path: string
  name: string
  renamingPath?: string | null
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()

const emit = defineEmits<{
  renameConfirm: [path: string, nextName: string]
  renameCancel: []
}>()

const { expandedPaths, togglePath, selectedPath } = useFileTreeContext()

const renameInputRef = ref<HTMLInputElement | null>(null)
const renameValue = ref('')

const isExpanded = computed(() => expandedPaths.value.has(props.path))
const isSelected = computed(() => selectedPath.value === props.path)
const isRenaming = computed(() => props.renamingPath === props.path)

provide(FileTreeFolderKey, {
  path: props.path,
  name: props.name,
  isExpanded: isExpanded.value,
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
    if (path === props.path) {
      renameValue.value = props.name
      await focusRenameInput()
    }
  },
)

const handleRenameKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Enter') {
    event.preventDefault()
    emit('renameConfirm', props.path, renameValue.value)
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('renameCancel')
  }
}

const handleRenameBlur = (): void => {
  if (isRenaming.value) {
    emit('renameConfirm', props.path, renameValue.value)
  }
}
</script>

<template>
  <Collapsible :open="isExpanded" @update:open="() => togglePath(props.path)">
    <div
      :class="cn('', props.class)"
      role="treeitem"
      tabindex="0"
      v-bind="$attrs"
    >
      <ContextMenu>
        <ContextMenuTrigger as-child>
          <CollapsibleTrigger as-child>
            <button
              :class="
                cn(
                  'flex w-full items-center gap-1 rounded px-2 py-1 text-left transition-colors hover:bg-muted/50',
                  isSelected && 'bg-muted',
                )
              "
              type="button"
            >
              <ChevronRightIcon
                :class="
                  cn(
                    'size-4 shrink-0 text-muted-foreground transition-transform',
                    isExpanded && 'rotate-90',
                  )
                "
              />
              <FileTreeIcon>
                <WorkbenchFileEntryIcon
                  :name="props.name"
                  is-directory
                  :is-open="isExpanded"
                />
              </FileTreeIcon>
              <Input
                v-if="isRenaming"
                ref="renameInputRef"
                v-model="renameValue"
                class="h-6 min-w-0 flex-1 px-1 py-0 text-sm"
                @keydown="handleRenameKeydown"
                @blur="handleRenameBlur"
                @click.stop
              />
              <FileTreeName v-else>{{ props.name }}</FileTreeName>
            </button>
          </CollapsibleTrigger>
        </ContextMenuTrigger>
        <WorkbenchFileTreeContextMenuContent
          :name="props.name"
          :path="props.path"
          :is-directory="true"
        />
      </ContextMenu>
      <CollapsibleContent>
        <div class="ml-4 border-l pl-2">
          <slot />
        </div>
      </CollapsibleContent>
    </div>
  </Collapsible>
</template>
