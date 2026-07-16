<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { toast } from 'vue-sonner'
import type { ChatStatus } from 'ai'
import { FolderIcon, ChevronDownIcon } from '@lucide/vue'
import { Button } from '@/components/shadcn/ui/button'
import { Input } from '@/components/shadcn/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/shadcn/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/ui/select'
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
import { CHAT_MODES, getChatModeMeta } from '@/constants/chat-modes'
import useFleetRegistry from '@/composables/use-fleet-registry'
import useGitBranches from '@/composables/use-git-branches'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import { listProviderModels } from '@/services/providers/list-provider-models'
import {
  getProviderCatalogEntry,
  keychainKeyForProvider,
  providerRequiresApiKey,
} from '@/services/providers/registry'
import { getSecret } from '@/services/pyrola/pyrola-tauri'
import type { PromptInputMessage } from '@/components/ai-elements/prompt-input/types'
import type { PyrolaChatMode, PyrolaCustomProvider } from '@/types/pyrola/pyrola-settings'

const props = withDefaults(
  defineProps<{
    status?: ChatStatus
    disabled?: boolean
    showProjectSelect?: boolean
  }>(),
  {
    status: 'ready',
    disabled: false,
    showProjectSelect: false,
  },
)

const emit = defineEmits<{
  submit: [payload: { text: string; mode: PyrolaChatMode; model: string }]
  stop: []
}>()

const fleet = useFleetRegistry()
const config = usePyrolaConfig()
const git = useGitBranches()

const session = reactive<{
  selectedMode: PyrolaChatMode
  selectedModel: string
  modeInitialized: boolean
  modelInitialized: boolean
}>({
  selectedMode: 'agent',
  selectedModel: '',
  modeInitialized: false,
  modelInitialized: false,
})

const modelPicker = reactive<{
  search: string
  providerModels: string[]
  loading: boolean
}>({
  search: '',
  providerModels: [],
  loading: false,
})

let modelsLoadGeneration = 0

const defaultProvider = computed(
  () => config.effectiveSettings.value['agent.defaultProvider'] ?? '',
)

const filteredProviderModels = computed(() => {
  const query = modelPicker.search.trim().toLowerCase()
  if (!query) {
    return modelPicker.providerModels
  }
  return modelPicker.providerModels.filter((model) => model.toLowerCase().includes(query))
})

const selectedModeMeta = computed(() => getChatModeMeta(session.selectedMode))

const activeProjectName = computed(
  () => fleet.activeProject.value?.name ?? 'No project',
)

const displayModelLabel = computed(() => {
  if (!session.selectedModel) {
    return ''
  }
  const segments = session.selectedModel.split('/')
  return segments[segments.length - 1] ?? session.selectedModel
})

const submitStatus = computed((): ChatStatus => props.status)

const getCustomProvider = (providerId: string): PyrolaCustomProvider | undefined => {
  const customKey = `providers.custom.${providerId}` as const
  return config.effectiveSettings.value[customKey] as PyrolaCustomProvider | undefined
}

const getApiKeyRef = (providerId: string): string | undefined => {
  const custom = getCustomProvider(providerId)
  if (custom?.apiKeyRef) {
    return custom.apiKeyRef
  }
  const key = `providers.${providerId}.apiKeyRef` as const
  return config.effectiveSettings.value[key]
}

const loadProviderModels = async (providerId: string): Promise<void> => {
  const generation = ++modelsLoadGeneration

  if (!providerId) {
    modelPicker.providerModels = []
    modelPicker.loading = false
    return
  }

  modelPicker.loading = true

  try {
    const custom = getCustomProvider(providerId)
    const catalogEntry = getProviderCatalogEntry(providerId)
    const requiresKey = custom ? false : providerRequiresApiKey(providerId)

    let apiKey = ''
    const apiKeyRef = getApiKeyRef(providerId)
    if (apiKeyRef) {
      apiKey = (await getSecret(keychainKeyForProvider(apiKeyRef))) ?? ''
    }

    if (requiresKey && !apiKey) {
      if (generation !== modelsLoadGeneration) {
        return
      }
      modelPicker.providerModels = catalogEntry?.models ?? []
      return
    }

    const models = await listProviderModels({
      providerId: custom ? 'openai' : providerId,
      catalogProviderId: providerId,
      apiKey,
      baseUrl: custom?.baseURL ?? catalogEntry?.defaultBaseUrl,
    })

    if (generation !== modelsLoadGeneration) {
      return
    }

    const merged = [...models]
    const defaultModel = config.effectiveSettings.value['agent.defaultModel']
    if (defaultModel && !merged.includes(defaultModel)) {
      merged.unshift(defaultModel)
    }
    if (session.selectedModel && !merged.includes(session.selectedModel)) {
      merged.unshift(session.selectedModel)
    }
    modelPicker.providerModels = merged
  } catch (error) {
    if (generation !== modelsLoadGeneration) {
      return
    }
    modelPicker.providerModels = getProviderCatalogEntry(providerId)?.models ?? []
    toast.error('Could not load models', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    if (generation === modelsLoadGeneration) {
      modelPicker.loading = false
    }
  }
}

const handleModeSelect = (mode: PyrolaChatMode): void => {
  session.selectedMode = mode
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

const handleModelChange = (value: unknown): void => {
  if (typeof value === 'string' && value.length > 0) {
    session.selectedModel = value
  }
}

const handleModelOpenChange = (open: boolean): void => {
  if (!open) {
    modelPicker.search = ''
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
  if (!session.selectedModel) {
    toast.error('Select a model before sending')
    return
  }
  emit('submit', {
    text,
    mode: session.selectedMode,
    model: session.selectedModel,
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
      const model = config.effectiveSettings.value['agent.defaultModel']
      if (model) {
        session.selectedModel = model
      }
      session.modelInitialized = true
    }
  },
  { immediate: true },
)

watch(defaultProvider, async (providerId) => {
  modelPicker.search = ''
  await loadProviderModels(providerId)
}, { immediate: true })
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

    <PromptInput
      accept="image/*"
      class="w-full [&_[data-slot=input-group]]:rounded-xl [&_[data-slot=input-group]]:border-border/50 [&_[data-slot=input-group]]:bg-background [&_[data-slot=input-group]]:shadow-sm"
      multiple
      @submit="handleSubmit"
    >
      <PromptInputBody>
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
        <PromptInputTools class="ml-auto shrink-0 items-center gap-4">
          <Select
            :model-value="session.selectedModel"
            :disabled="!defaultProvider || modelPicker.loading || disabled"
            @update:model-value="handleModelChange"
            @update:open="handleModelOpenChange"
          >
            <SelectTrigger
              class="h-8 w-auto max-w-none shrink-0 border-0 bg-transparent px-2 shadow-none focus:ring-0 [&_[data-slot=select-value]]:line-clamp-none"
              :title="session.selectedModel || 'No model'"
            >
              <SelectValue :placeholder="defaultProvider ? 'Select model' : 'No model'">
                {{ displayModelLabel }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent class="w-72 p-0">
              <div class="border-b border-border/50 p-2" @pointerdown.stop>
                <Input
                  v-model="modelPicker.search"
                  placeholder="Search models…"
                  class="h-8"
                  @keydown.stop
                />
              </div>
              <div class="max-h-72 overflow-y-auto p-1">
                <SelectItem
                  v-for="model in filteredProviderModels"
                  :key="model"
                  :value="model"
                >
                  {{ model }}
                </SelectItem>
                <p
                  v-if="!modelPicker.loading && filteredProviderModels.length === 0"
                  class="px-2 py-4 text-center text-sm text-muted-foreground"
                >
                  {{
                    modelPicker.search.trim()
                      ? 'No models match your search.'
                      : 'No models available.'
                  }}
                </p>
              </div>
            </SelectContent>
          </Select>
          <PromptInputSubmit
            class="ml-1 shrink-0"
            :status="submitStatus"
            :disabled="disabled && status !== 'streaming'"
          />
        </PromptInputTools>
      </PromptInputFooter>
    </PromptInput>
    <div
      v-if="git.isRepo.value"
      class="mt-1 flex items-center px-1"
    >
      <ChatGitBranchSelect />
    </div>
  </div>
</template>
