<script setup lang="ts">
import { ref } from 'vue'
import { BrainIcon, CircleUserRoundIcon, FolderIcon } from '@lucide/vue'
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input'
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from '@/components/ai-elements/model-selector'
const CHAT_MODES = [
  { value: 'ask', label: 'Ask' },
  { value: 'plan', label: 'Plan' },
  { value: 'studio', label: 'Studio' },
  { value: 'agent', label: 'Agent' },
] as const

const PROJECTS = [
  { value: 'pyrola', label: 'pyrola' },
  { value: 'platform', label: 'platform' },
  { value: 'marketing', label: 'marketing' },
] as const

const MODELS = [
  { id: 'anthropic/claude-sonnet-4', provider: 'anthropic', label: 'Claude Sonnet 4' },
  { id: 'openai/gpt-4o', provider: 'openai', label: 'GPT-4o' },
  { id: 'google/gemini-2.5-pro', provider: 'google', label: 'Gemini 2.5 Pro' },
] as const

const selectedMode = ref<(typeof CHAT_MODES)[number]['value']>('agent')
const selectedProject = ref<(typeof PROJECTS)[number]['value']>('pyrola')
const selectedModelId = ref<(typeof MODELS)[number]['id']>('anthropic/claude-sonnet-4')
const modelSelectorOpen = ref(false)

const selectedModeLabel = () =>
  CHAT_MODES.find((mode) => mode.value === selectedMode.value)?.label ?? 'Mode'

const selectedProjectLabel = () =>
  PROJECTS.find((project) => project.value === selectedProject.value)?.label ?? 'Project'

const selectedModelLabel = () =>
  MODELS.find((model) => model.id === selectedModelId.value)?.label ?? 'Model'

const handleModeSelect = (mode: (typeof CHAT_MODES)[number]['value']) => {
  selectedMode.value = mode
}

const handleProjectSelect = (project: (typeof PROJECTS)[number]['value']) => {
  selectedProject.value = project
}

const handleModelSelect = (modelId: (typeof MODELS)[number]['id']) => {
  selectedModelId.value = modelId
  modelSelectorOpen.value = false
}
</script>

<template>
  <div class="mx-auto w-full max-w-3xl">
    <PromptInput
      accept="image/*"
      class="w-full"
      multiple
    >
      <PromptInputBody>
        <PromptInputTextarea
          class="min-h-24"
          placeholder="Plan, build, / for skills, @ for context"
        />
      </PromptInputBody>
      <PromptInputFooter>
        <PromptInputTools>
          <PromptInputActionMenu>
            <PromptInputActionMenuTrigger />
            <PromptInputActionMenuContent>
              <PromptInputActionAddAttachments label="Upload photos or files" />
            </PromptInputActionMenuContent>
          </PromptInputActionMenu>
          <PromptInputActionMenu>
            <PromptInputActionMenuTrigger :title="`${selectedModeLabel()} mode`">
              <CircleUserRoundIcon class="size-4" />
            </PromptInputActionMenuTrigger>
            <PromptInputActionMenuContent>
              <PromptInputActionMenuItem
                v-for="mode in CHAT_MODES"
                :key="mode.value"
                @select="handleModeSelect(mode.value)"
              >
                {{ mode.label }}
              </PromptInputActionMenuItem>
            </PromptInputActionMenuContent>
          </PromptInputActionMenu>
          <PromptInputActionMenu>
            <PromptInputActionMenuTrigger :title="`${selectedProjectLabel()} project`">
              <FolderIcon class="size-4" />
            </PromptInputActionMenuTrigger>
            <PromptInputActionMenuContent>
              <PromptInputActionMenuItem
                v-for="project in PROJECTS"
                :key="project.value"
                @select="handleProjectSelect(project.value)"
              >
                {{ project.label }}
              </PromptInputActionMenuItem>
            </PromptInputActionMenuContent>
          </PromptInputActionMenu>
        </PromptInputTools>
        <PromptInputTools>
          <ModelSelector v-model:open="modelSelectorOpen">
            <ModelSelectorTrigger as-child>
              <PromptInputButton
                variant="ghost"
                :title="selectedModelLabel()"
              >
                <BrainIcon class="size-4" />
              </PromptInputButton>
            </ModelSelectorTrigger>
            <ModelSelectorContent title="Select model">
              <ModelSelectorInput placeholder="Search models…" />
              <ModelSelectorList>
                <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                <ModelSelectorGroup heading="Models">
                  <ModelSelectorItem
                    v-for="model in MODELS"
                    :key="model.id"
                    :value="model.id"
                    @select="handleModelSelect(model.id)"
                  >
                    <ModelSelectorLogo :provider="model.provider" />
                    <ModelSelectorName>{{ model.label }}</ModelSelectorName>
                  </ModelSelectorItem>
                </ModelSelectorGroup>
              </ModelSelectorList>
            </ModelSelectorContent>
          </ModelSelector>
          <PromptInputSubmit />
        </PromptInputTools>
      </PromptInputFooter>
    </PromptInput>
  </div>
</template>
