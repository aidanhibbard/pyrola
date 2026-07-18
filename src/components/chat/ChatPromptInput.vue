<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { toast } from 'vue-sonner'
import type { ChatStatus } from 'ai'
import { FolderIcon, ChevronDownIcon, RotateCcwIcon, XIcon } from '@lucide/vue'
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
import ChatContextUsageBar from '@/components/chat/ContextUsageBar.vue'
import ChatPromptEditSync from '@/components/chat/ChatPromptEditSync.vue'
import ModelsSearchModelSearchPicker from '@/components/models/search/ModelSearchPicker.vue'
import { CHAT_MODES, getChatModeMeta } from '@/constants/chat-modes'
import useFleetRegistry from '@/composables/use-fleet-registry'
import useGitBranches from '@/composables/use-git-branches'
import useChatStore from '@/composables/use-chat-store'
import useContextUsage from '@/composables/use-context-usage'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import resolveModelForRole from '@/services/models/resolve-model-for-role'
import listConfiguredProviders from '@/services/providers/list-configured-providers'
import { normalizeStoredModelRef } from '@/schemas/pyrola-settings'
import parseModelRef from '@/utils/parse-model-ref'
import type { PromptInputMessage } from '@/components/ai-elements/prompt-input/types'
import type { PyrolaChatMode } from '@/types/pyrola/pyrola-settings'

const props = withDefaults(
  defineProps<{
    status?: ChatStatus
    disabled?: boolean
    showProjectSelect?: boolean
    showContextUsage?: boolean
  }>(),
  {
    status: 'ready',
    disabled: false,
    showProjectSelect: false,
    showContextUsage: false,
  },
)

const emit = defineEmits<{
  submit: [payload: { text: string; mode: PyrolaChatMode; model: string }]
  submitEdit: [payload: { text: string; mode: PyrolaChatMode; model: string }]
  reset: [payload: { mode: PyrolaChatMode; model: string }]
  stop: []
}>()

const fleet = useFleetRegistry()
const config = usePyrolaConfig()
const git = useGitBranches()
const chatStore = useChatStore()
const contextUsage = useContextUsage()

const session = reactive<{
  selectedMode: PyrolaChatMode
  selectedModelRef: string
  modeInitialized: boolean
  modelInitialized: boolean
}>({
  selectedMode: 'agent',
  selectedModelRef: '',
  modeInitialized: false,
  modelInitialized: false,
})

const hasProviders = computed(
  () => listConfiguredProviders(config.effectiveSettings.value).length > 0,
)

const selectedModeMeta = computed(() => getChatModeMeta(session.selectedMode))

const activeProjectName = computed(
  () => fleet.activeProject.value?.name ?? 'No project',
)

const submitStatus = computed((): ChatStatus => props.status)

const isEditing = computed(() => chatStore.editingMessageId.value !== null)

const canReset = computed(() => chatStore.canResetToLastQuestion.value)

const isAgentBusy = computed(
  () => props.status === 'streaming' || props.status === 'submitted',
)

const resolvedModelIdForContext = computed(() => {
  const parsed = parseModelRef(session.selectedModelRef)
  if (parsed) {
    return parsed.modelId
  }
  return session.selectedModelRef
})

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
}

const handleProjectSelect = async (projectId: string): Promise<void> => {
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
  }
}

const handleSubmit = (payload: PromptInputMessage): void => {
  if (props.status === 'streaming') {
    emit('stop')
    return
  }
  const text = payload.text.trim()
  if (!text || props.disabled) {
    return
  }
  if (!session.selectedModelRef) {
    toast.error('Select a model before sending')
    return
  }
  const submitPayload = {
    text,
    mode: session.selectedMode,
    model: session.selectedModelRef,
  }
  if (isEditing.value) {
    emit('submitEdit', submitPayload)
    return
  }
  emit('submit', submitPayload)
}

const handleCancelEdit = (): void => {
  chatStore.cancelEditMessage()
}

const handleReset = (): void => {
  if (!canReset.value || isAgentBusy.value || props.disabled) {
    return
  }
  if (!session.selectedModelRef) {
    toast.error('Select a model before resetting')
    return
  }
  emit('reset', {
    mode: session.selectedMode,
    model: session.selectedModelRef,
  })
}

const refreshContextBudget = async (): Promise<void> => {
  if (!props.showContextUsage) {
    return
  }

  const project = fleet.activeProject.value
  const modelId =
    resolvedModelIdForContext.value || chatStore.meta.value?.model || ''
  if (!project || !modelId) {
    return
  }

  await contextUsage.refresh({
    modelId,
    mode: session.selectedMode,
    projectName: project.name,
    projectRoot: project.rootPath,
    messages: chatStore.messages.value,
  })
}

watch(
  () => config.hydrated.value,
  (hydrated) => {
    if (!hydrated) {
      return
    }
    if (!session.modeInitialized) {
      session.selectedMode = config.effectiveSettings.value['agent.defaultMode'] ?? 'agent'
      session.modeInitialized = true
    }
    if (!session.modelInitialized) {
      const resolved = resolveInitialModelRef(session.selectedMode)
      if (resolved) {
        session.selectedModelRef = resolved
      }
      session.modelInitialized = true
    }
  },
  { immediate: true },
)

watch(
  () => chatStore.meta.value,
  (meta) => {
    if (!meta || !props.showContextUsage) {
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
  },
  { immediate: true },
)

watch(
  [
    () => props.showContextUsage,
    () => session.selectedModelRef,
    () => session.selectedMode,
    () => chatStore.messages.value.length,
    () => fleet.activeProject.value?.id,
    () => chatStore.meta.value?.model,
  ],
  () => {
    refreshContextBudget().catch((error) => {
      toast.error('Failed to refresh context usage', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    })
  },
  { immediate: true },
)
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col">
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

    <PromptInput
      accept="image/*"
      class="w-full [&_[data-slot=input-group]]:rounded-xl [&_[data-slot=input-group]]:border-border/50 [&_[data-slot=input-group]]:bg-background [&_[data-slot=input-group]]:shadow-sm"
      multiple
      @submit="handleSubmit"
    >
      <PromptInputBody>
        <ChatPromptEditSync />
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
          <Button
            v-if="canReset"
            type="button"
            variant="ghost"
            size="icon"
            class="size-8 shrink-0"
            title="Reset to last question"
            :disabled="disabled || isAgentBusy"
            @click="handleReset"
          >
            <RotateCcwIcon class="size-4" />
          </Button>
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
            :disabled="disabled && status !== 'streaming'"
          />
        </PromptInputTools>
      </PromptInputFooter>
    </PromptInput>
    <div
      v-if="git.isRepo.value || showContextUsage"
      class="mt-1 flex items-center justify-between gap-2 px-1"
    >
      <ChatGitBranchSelect v-if="git.isRepo.value" />
      <div v-else />
      <ChatContextUsageBar
        v-if="showContextUsage"
        :trigger-disabled="disabled"
      />
    </div>
  </div>
</template>
