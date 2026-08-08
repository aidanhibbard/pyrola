<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import type { ChatStatus } from 'ai'
import { FolderIcon, ChevronDownIcon, XIcon } from '@lucide/vue'
import { Button } from '@/components/shadcn/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/shadcn/ui/dropdown-menu'
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input'
import ChatGitBranchSelect from '@/components/chat/GitBranchSelect.vue'
import ChatMcpServerPicker from '@/components/chat/ChatMcpServerPicker.vue'
import ChatSkillsPicker from '@/components/chat/ChatSkillsPicker.vue'
import ChatPermissionDial from '@/components/chat/ChatPermissionDial.vue'
import ChatPromptAttachments from '@/components/chat/ChatPromptAttachments.vue'
import ChatPromptEditSync from '@/components/chat/ChatPromptEditSync.vue'
import ChatPromptMentionSync from '@/components/chat/ChatPromptMentionSync.vue'
import ChatPromptSkillSync from '@/components/chat/ChatPromptSkillSync.vue'
import ModelsSearchModelSearchPicker from '@/components/models/search/ModelSearchPicker.vue'
import { CHAT_MODES, getChatModeMeta } from '@/constants/chat-modes'
import useFleetRegistry from '@/composables/use-fleet-registry'
import useGitBranches from '@/composables/use-git-branches'
import useChatStore from '@/composables/use-chat-store'
import useChatContextBudgetSync from '@/composables/use-chat-context-budget-sync'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import resolveModelForRole from '@/services/models/resolve-model-for-role'
import listConfiguredProviders from '@/services/providers/list-configured-providers'
import { normalizeStoredModelRef } from '@/schemas/pyrola-settings'
import { HOME_CHAT_SLUG } from '@/constants/home-chat'
import type { PromptInputMessage } from '@/components/ai-elements/prompt-input/types'
import type { PermissionLevel } from '@/types/harness/permission'
import type { PyrolaChatMode } from '@/types/pyrola/pyrola-settings'
import type { FileUIPart } from 'ai'

const props = withDefaults(
  defineProps<{
    status?: ChatStatus
    disabled?: boolean
    showProjectSelect?: boolean
    permissionLevel?: PermissionLevel
  }>(),
  {
    status: 'ready',
    disabled: false,
    showProjectSelect: false,
    permissionLevel: undefined,
  },
)

const emit = defineEmits<{
  submit: [payload: {
    text: string
    mode: PyrolaChatMode
    model: string
    projectId: string | null
    permissionLevel: PermissionLevel
    files?: FileUIPart[]
  }]
  submitEdit: [payload: { text: string; mode: PyrolaChatMode; model: string }]
  stop: []
  'update:permissionLevel': [value: PermissionLevel]
}>()

const fleet = useFleetRegistry()
const config = usePyrolaConfig()
const git = useGitBranches()
const chatStore = useChatStore()
const contextBudgetSync = useChatContextBudgetSync()

const syncDraftSelection = (): void => {
  contextBudgetSync.setDraftSelection(session.selectedModelRef, session.selectedMode)
}

const resolveDefaultPermissionLevel = (): PermissionLevel =>
  props.permissionLevel
  ?? config.effectiveSettings.value['agent.permissionLevel']
  ?? 'allowlist'

const localPermissionLevel = ref<PermissionLevel>(resolveDefaultPermissionLevel())

const session = reactive<{
  selectedMode: PyrolaChatMode
  selectedModelRef: string
  modeInitialized: boolean
  modelInitialized: boolean
  selectedProjectId: string | null
  projectSelectionInitialized: boolean
}>({
  selectedMode: 'agent',
  selectedModelRef: '',
  modeInitialized: false,
  modelInitialized: false,
  selectedProjectId: null,
  projectSelectionInitialized: false,
})

const hasProviders = computed(
  () => listConfiguredProviders(config.effectiveSettings.value).length > 0,
)

const selectedModeMeta = computed(() => getChatModeMeta(session.selectedMode))

const activeProjectName = computed(() => {
  if (!props.showProjectSelect) {
    return fleet.activeProject.value?.name ?? 'No project'
  }
  if (session.selectedProjectId === null) {
    return 'No project'
  }
  return (
    fleet.projects.value.find((project) => project.id === session.selectedProjectId)?.name ??
    'No project'
  )
})

const submitStatus = computed((): ChatStatus => props.status)

const isWaitingOnReply = computed(
  () => props.status === 'submitted' || props.status === 'streaming',
)

const isEditing = computed(() => chatStore.editingMessageId.value !== null)

const promptInputClass = computed(() => {
  const base =
    'w-full [&_[data-slot=input-group]]:rounded-xl [&_[data-slot=input-group]]:shadow-sm'
  if (isWaitingOnReply.value) {
    return base
  }
  return `${base} [&_[data-slot=input-group]]:border-border/50 [&_[data-slot=input-group]]:bg-background`
})

const promptWorkspaceRoot = computed((): string | null | undefined => {
  if (props.showProjectSelect) {
    if (session.selectedProjectId === null) {
      return null
    }
    return (
      fleet.projects.value.find((project) => project.id === session.selectedProjectId)
        ?.rootPath ?? null
    )
  }

  if (chatStore.meta.value?.projectSlug === HOME_CHAT_SLUG) {
    return null
  }

  return undefined
})

const showGitBranch = computed(
  () => git.isRepo.value && promptWorkspaceRoot.value !== null,
)

const resolveInitialModelRef = (mode: PyrolaChatMode, metaModel?: string): string => {
  const settings = config.effectiveSettings.value
  const normalizedMeta = metaModel
    ? normalizeStoredModelRef(metaModel) ?? metaModel
    : undefined

  if (normalizedMeta) {
    return normalizedMeta
  }

  return resolveModelForRole(mode, settings) ?? ''
}

const handleModeSelect = (mode: PyrolaChatMode): void => {
  session.selectedMode = mode
  if (!session.selectedModelRef) {
    const resolved = resolveModelForRole(mode, config.effectiveSettings.value)
    if (resolved) {
      session.selectedModelRef = resolved
    }
  }
  syncDraftSelection()
}

const handleProjectSelect = async (projectId: string | null): Promise<void> => {
  session.selectedProjectId = projectId
  if (!projectId) {
    return
  }
  try {
    await fleet.setActiveProject(projectId)
  } catch (error) {
    toast.error('Could not switch project', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const handleModelChange = (value: string): void => {
  if (value.length > 0) {
    session.selectedModelRef = value
    syncDraftSelection()
  }
}

const handlePermissionLevelChange = (level: PermissionLevel): void => {
  localPermissionLevel.value = level
  emit('update:permissionLevel', level)
}

const handleSubmit = (payload: PromptInputMessage): void => {
  if (props.status === 'streaming' || props.status === 'submitted') {
    emit('stop')
    return
  }
  const text = payload.text.trim()
  const files = payload.files ?? []
  if ((!text && files.length === 0) || props.disabled) {
    return
  }
  if (!session.selectedModelRef) {
    toast.error('Select a model before sending')
    return
  }
  const submitPayload = {
    text: text || (files.length > 0 ? 'See attached image(s).' : ''),
    mode: session.selectedMode,
    model: session.selectedModelRef,
    projectId: props.showProjectSelect
      ? session.selectedProjectId
      : fleet.activeProject.value?.id ?? null,
    permissionLevel: localPermissionLevel.value,
    files,
  }
  if (isEditing.value) {
    emit('submitEdit', {
      text: submitPayload.text,
      mode: submitPayload.mode,
      model: submitPayload.model,
    })
    return
  }
  emit('submit', submitPayload)
}

const handleCancelEdit = (): void => {
  chatStore.cancelEditMessage()
}

watch(
  promptWorkspaceRoot,
  (root) => {
    git.setWorkspaceRoot(root)
  },
  { immediate: true },
)

watch(
  () => props.permissionLevel,
  (level) => {
    if (level !== undefined) {
      localPermissionLevel.value = level
    }
  },
)

watch(
  () => fleet.loaded.value,
  (loaded) => {
    if (!loaded || session.projectSelectionInitialized || !props.showProjectSelect) {
      return
    }
    session.selectedProjectId = fleet.activeProject.value?.id ?? null
    session.projectSelectionInitialized = true
  },
  { immediate: true },
)

watch(
  () => config.hydrated.value,
  (hydrated) => {
    if (!hydrated) {
      return
    }
    if (props.permissionLevel === undefined) {
      localPermissionLevel.value =
        config.effectiveSettings.value['agent.permissionLevel'] ?? 'allowlist'
    }
    if (!session.modeInitialized) {
      session.selectedMode = 'agent'
      session.modeInitialized = true
    }
    if (!session.modelInitialized) {
      const resolved = resolveInitialModelRef(session.selectedMode)
      if (resolved) {
        session.selectedModelRef = resolved
      }
      session.modelInitialized = true
    }
    syncDraftSelection()
  },
  { immediate: true },
)

watch(
  () => chatStore.meta.value,
  (meta) => {
    if (!meta) {
      return
    }
    if (meta.model) {
      const normalized =
        normalizeStoredModelRef(meta.model) ?? meta.model
      session.selectedModelRef = normalized.includes('::')
        ? normalized
        : resolveInitialModelRef(meta.mode ?? session.selectedMode, undefined)
    }
    if (meta.mode) {
      session.selectedMode = meta.mode
    }
    syncDraftSelection()
  },
  { immediate: true },
)
</script>

<template>
  <div class="mx-auto flex w-full max-w-xl flex-col">
    <DropdownMenu v-if="showProjectSelect">
      <DropdownMenuTrigger as-child>
        <Button
          variant="ghost"
          size="sm"
          class="mb-2 h-8 w-fit max-w-full gap-1.5 px-1 text-muted-foreground hover:text-foreground"
          :title="`${activeProjectName} project`"
        >
          <FolderIcon class="size-4 shrink-0" />
          <span class="truncate text-sm">{{ activeProjectName }}</span>
          <ChevronDownIcon class="size-3 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" class="w-56">
        <DropdownMenuItem @select="handleProjectSelect(null)">
          No project
        </DropdownMenuItem>
        <DropdownMenuItem
          v-for="project in fleet.projects.value"
          :key="project.id"
          @select="handleProjectSelect(project.id)"
        >
          {{ project.name }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <div
      v-if="isEditing"
      class="mb-2 flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground"
    >
      <span>Editing message</span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        class="h-7 gap-1 px-2"
        @click="handleCancelEdit"
      >
        <XIcon class="size-3.5" />
        Cancel
      </Button>
    </div>

    <div :class="isWaitingOnReply ? 'chat-prompt-aurora' : undefined">
      <PromptInput
        accept="image/*"
        :class="promptInputClass"
        multiple
        @submit="handleSubmit"
      >
        <ChatPromptAttachments />
        <PromptInputBody>
          <ChatPromptEditSync />
          <ChatPromptMentionSync />
          <ChatPromptSkillSync />
          <PromptInputTextarea
            class="max-h-28 min-h-10 resize-none py-2.5"
            placeholder="Plan, build, / for skills, @ for context"
          />
        </PromptInputBody>
        <PromptInputFooter class="px-1 pb-1">
          <PromptInputTools class="min-w-0 flex-1 gap-1">
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger />
              <PromptInputActionMenuContent>
                <PromptInputActionAddAttachments label="Upload photos or files" />
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger
                size="sm"
                class="shrink-0"
                :title="`${selectedModeMeta.label} mode`"
              >
                <component :is="selectedModeMeta.icon" class="size-4 shrink-0" />
                <span class="text-sm">{{ selectedModeMeta.label }}</span>
              </PromptInputActionMenuTrigger>
              <PromptInputActionMenuContent>
                <PromptInputActionMenuItem
                  v-for="mode in CHAT_MODES"
                  :key="mode.value"
                  class="gap-2"
                  @select="handleModeSelect(mode.value)"
                >
                  <component :is="mode.icon" class="size-4 shrink-0" />
                  {{ mode.label }}
                </PromptInputActionMenuItem>
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
          </PromptInputTools>
          <PromptInputTools class="ml-auto shrink-0 items-center gap-2">
            <ModelsSearchModelSearchPicker
              :model-value="session.selectedModelRef"
              compact
              :disabled="!hasProviders || disabled"
              placeholder="Select model"
              @update:model-value="handleModelChange"
            />
            <PromptInputSubmit
              class="ml-1 shrink-0"
              :status="submitStatus"
              :disabled="disabled && status !== 'streaming' && status !== 'submitted'"
            />
          </PromptInputTools>
        </PromptInputFooter>
      </PromptInput>
    </div>
    <div class="mt-1 flex items-center gap-2 px-1">
      <ChatPermissionDial
        :model-value="localPermissionLevel"
        @update:model-value="handlePermissionLevelChange"
      />
      <ChatGitBranchSelect v-if="showGitBranch" />
      <div class="ml-auto flex items-center gap-2">
        <ChatMcpServerPicker />
        <ChatSkillsPicker :mode="session.selectedMode" />
      </div>
    </div>
  </div>
</template>
