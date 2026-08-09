<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronDown, Loader2, Plus, Trash2 } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/shadcn/ui/button'
import { Input } from '@/components/shadcn/ui/input'
import { Label } from '@/components/shadcn/ui/label'
import { Switch } from '@/components/shadcn/ui/switch'
import { Textarea } from '@/components/shadcn/ui/textarea'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/shadcn/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/ui/dialog'
import SettingsInputPasswordInput from '@/components/settings/input/PasswordInput.vue'
import type {
  PyrolaCustomProvider,
  PyrolaCustomProviderModel,
} from '@/types/pyrola/pyrola-settings'
import {
  customProviderSchema,
  formatCustomProviderSchemaError,
} from '@/schemas/providers/custom-provider'
import { testProviderConnection } from '@/services/providers/test-connection'
import { listProviderModels } from '@/services/providers/list-provider-models'

type KeyValueRow = {
  key: string
  value: string
}

type ModelDraft = {
  id: string
  name: string
  maxInputTokens: string
  maxOutputTokens: string
  contextWindow: string
  toolCalling: boolean
  vision: boolean
  thinking: boolean
  streaming: boolean
  supportsReasoningEffort: string
  reasoningEffort: string
  temperature: string
  topP: string
  topK: string
  frequencyPenalty: string
  presencePenalty: string
  seed: string
  headers: KeyValueRow[]
  modelOptionsJson: string
  advancedOpen: boolean
}

const props = defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  providerId?: string | null
  initialProvider?: PyrolaCustomProvider | null
  initialApiKeyConfigured?: boolean
  resolveStoredApiKey?: () => Promise<string>
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  save: [
    payload: {
      providerId: string
      provider: PyrolaCustomProvider
      apiKey: string | null
      clearApiKey: boolean
    },
  ]
}>()

const name = ref('local')
const baseURL = ref('http://localhost:1234/v1')
const apiKeyInput = ref('')
const clearApiKey = ref(false)
const includeUsage = ref(true)
const supportsStructuredOutputs = ref(false)
const headers = ref<KeyValueRow[]>([])
const queryParams = ref<KeyValueRow[]>([])
const models = ref<ModelDraft[]>([])
const testing = ref(false)
const importingModels = ref(false)
const requestExtrasOpen = ref(false)

const dialogSurfaceClass =
  'overflow-x-hidden border-border/80 bg-zinc-50 shadow-2xl backdrop-blur-none dark:bg-zinc-900 sm:max-w-2xl'

const fieldClass = 'min-w-0 focus-visible:ring-inset'
const flexFieldClass = 'min-w-0 flex-1 focus-visible:ring-inset'

const title = computed(() =>
  props.mode === 'create' ? 'Custom OpenAI-compatible provider' : 'Manage provider',
)

const configuredModelCount = computed(
  () => models.value.filter((model) => model.id.trim().length > 0).length,
)

const createEmptyModel = (): ModelDraft => ({
  id: '',
  name: '',
  maxInputTokens: '',
  maxOutputTokens: '',
  contextWindow: '',
  toolCalling: true,
  vision: false,
  thinking: false,
  streaming: true,
  supportsReasoningEffort: '',
  reasoningEffort: '',
  temperature: '',
  topP: '',
  topK: '',
  frequencyPenalty: '',
  presencePenalty: '',
  seed: '',
  headers: [],
  modelOptionsJson: '',
  advancedOpen: false,
})

const recordToRows = (record?: Record<string, string>): KeyValueRow[] => {
  if (!record) {
    return []
  }
  return Object.entries(record).map(([key, value]) => ({ key, value }))
}

const rowsToRecord = (rows: KeyValueRow[]): Record<string, string> | undefined => {
  const next: Record<string, string> = {}
  for (const row of rows) {
    const key = row.key.trim()
    if (!key) {
      continue
    }
    next[key] = row.value
  }
  return Object.keys(next).length > 0 ? next : undefined
}

const parseOptionalNumber = (value: string): number | undefined => {
  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number: ${trimmed}`)
  }
  return parsed
}

const modelToDraft = (model: PyrolaCustomProviderModel): ModelDraft => ({
  id: model.id,
  name: model.name ?? '',
  maxInputTokens: model.maxInputTokens?.toString() ?? '',
  maxOutputTokens: model.maxOutputTokens?.toString() ?? '',
  contextWindow: model.contextWindow?.toString() ?? '',
  toolCalling: model.toolCalling ?? true,
  vision: model.vision ?? false,
  thinking: model.thinking ?? false,
  streaming: model.streaming ?? true,
  supportsReasoningEffort: model.supportsReasoningEffort?.join(', ') ?? '',
  reasoningEffort: model.reasoningEffort ?? '',
  temperature: model.temperature?.toString() ?? '',
  topP: model.topP?.toString() ?? '',
  topK: model.topK?.toString() ?? '',
  frequencyPenalty: model.frequencyPenalty?.toString() ?? '',
  presencePenalty: model.presencePenalty?.toString() ?? '',
  seed: model.seed?.toString() ?? '',
  headers: recordToRows(model.headers),
  modelOptionsJson: model.modelOptions ? JSON.stringify(model.modelOptions, null, 2) : '',
  advancedOpen: false,
})

const draftToModel = (draft: ModelDraft): PyrolaCustomProviderModel => {
  const model: PyrolaCustomProviderModel = {
    id: draft.id.trim(),
  }
  if (draft.name.trim()) {
    model.name = draft.name.trim()
  }
  const maxInputTokens = parseOptionalNumber(draft.maxInputTokens)
  if (maxInputTokens !== undefined) {
    model.maxInputTokens = maxInputTokens
  }
  const maxOutputTokens = parseOptionalNumber(draft.maxOutputTokens)
  if (maxOutputTokens !== undefined) {
    model.maxOutputTokens = maxOutputTokens
  }
  const contextWindow = parseOptionalNumber(draft.contextWindow)
  if (contextWindow !== undefined) {
    model.contextWindow = contextWindow
  }
  model.toolCalling = draft.toolCalling
  model.vision = draft.vision
  model.thinking = draft.thinking
  model.streaming = draft.streaming
  const efforts = draft.supportsReasoningEffort
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  if (efforts.length > 0) {
    model.supportsReasoningEffort = efforts
  }
  if (draft.reasoningEffort.trim()) {
    model.reasoningEffort = draft.reasoningEffort.trim()
  }
  const temperature = parseOptionalNumber(draft.temperature)
  if (temperature !== undefined) {
    model.temperature = temperature
  }
  const topP = parseOptionalNumber(draft.topP)
  if (topP !== undefined) {
    model.topP = topP
  }
  const topK = parseOptionalNumber(draft.topK)
  if (topK !== undefined) {
    model.topK = topK
  }
  const frequencyPenalty = parseOptionalNumber(draft.frequencyPenalty)
  if (frequencyPenalty !== undefined) {
    model.frequencyPenalty = frequencyPenalty
  }
  const presencePenalty = parseOptionalNumber(draft.presencePenalty)
  if (presencePenalty !== undefined) {
    model.presencePenalty = presencePenalty
  }
  const seed = parseOptionalNumber(draft.seed)
  if (seed !== undefined) {
    model.seed = seed
  }
  const modelHeaders = rowsToRecord(draft.headers)
  if (modelHeaders) {
    model.headers = modelHeaders
  }
  if (draft.modelOptionsJson.trim()) {
    const parsed = JSON.parse(draft.modelOptionsJson) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`Model ${draft.id || '(unnamed)'}: modelOptions must be a JSON object`)
    }
    model.modelOptions = parsed as Record<string, unknown>
  }
  return model
}

const resetForm = (): void => {
  const initial = props.initialProvider
  name.value = initial?.name ?? 'local'
  baseURL.value = initial?.baseURL ?? 'http://localhost:1234/v1'
  apiKeyInput.value = ''
  clearApiKey.value = false
  includeUsage.value = initial?.includeUsage ?? true
  supportsStructuredOutputs.value = initial?.supportsStructuredOutputs ?? false
  headers.value = recordToRows(initial?.headers)
  queryParams.value = recordToRows(initial?.queryParams)
  models.value = initial?.models?.map(modelToDraft) ?? []
  testing.value = false
  importingModels.value = false
  requestExtrasOpen.value = Boolean(initial?.headers || initial?.queryParams)
}

watch(
  () => [props.open, props.mode, props.providerId] as const,
  ([open]) => {
    if (open) {
      resetForm()
    }
  },
)

const handleOpenChange = (open: boolean): void => {
  emit('update:open', open)
}

const addKeyValueRow = (rows: KeyValueRow[]): void => {
  rows.push({ key: '', value: '' })
}

const removeKeyValueRow = (rows: KeyValueRow[], index: number): void => {
  rows.splice(index, 1)
}

const addModel = (partial?: Partial<ModelDraft>): void => {
  models.value.push({
    ...createEmptyModel(),
    ...partial,
  })
}

const removeModel = (index: number): void => {
  models.value.splice(index, 1)
}

const resolveApiKeyForRequest = async (): Promise<string> => {
  if (apiKeyInput.value.trim()) {
    return apiKeyInput.value.trim()
  }
  if (props.resolveStoredApiKey) {
    return (await props.resolveStoredApiKey()) || ''
  }
  return ''
}

const importModelsFromEndpoint = async (): Promise<void> => {
  importingModels.value = true
  try {
    const trimmedBaseUrl = baseURL.value.trim()
    if (!trimmedBaseUrl) {
      throw new Error('Base URL is required')
    }

    const liveIds = await listProviderModels({
      providerId: 'openai',
      apiKey: await resolveApiKeyForRequest(),
      baseUrl: trimmedBaseUrl,
    })

    if (liveIds.length === 0) {
      toast.error('No models returned by endpoint')
      return
    }

    const existing = new Set(
      models.value.map((model) => model.id.trim()).filter((id) => id.length > 0),
    )
    let added = 0
    for (const modelId of liveIds) {
      if (existing.has(modelId)) {
        continue
      }
      addModel({ id: modelId, name: modelId })
      existing.add(modelId)
      added += 1
    }

    if (added === 0) {
      toast.success('All endpoint models are already in the list')
      return
    }

    toast.success(`Imported ${added} model${added === 1 ? '' : 's'}`)
  } catch (error) {
    toast.error('Failed to import models', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    importingModels.value = false
  }
}

const buildProvider = (): { providerId: string; provider: PyrolaCustomProvider } => {
  const trimmedName = name.value.trim()
  const trimmedBaseUrl = baseURL.value.trim()
  const providerId =
    props.mode === 'edit' && props.providerId
      ? props.providerId
      : trimmedName.toLowerCase().replace(/\s+/g, '-')

  const providerModels = models.value
    .filter((draft) => draft.id.trim().length > 0)
    .map(draftToModel)

  const provider: PyrolaCustomProvider = {
    type: 'openai-compatible',
    name: trimmedName,
    baseURL: trimmedBaseUrl,
    apiKeyRef: props.initialProvider?.apiKeyRef ?? providerId,
    includeUsage: includeUsage.value,
    supportsStructuredOutputs: supportsStructuredOutputs.value || undefined,
    headers: rowsToRecord(headers.value),
    queryParams: rowsToRecord(queryParams.value),
    models: providerModels.length > 0 ? providerModels : undefined,
  }

  const parsed = customProviderSchema.safeParse(provider)
  if (!parsed.success) {
    throw new Error(formatCustomProviderSchemaError(parsed.error))
  }

  return { providerId, provider: parsed.data }
}

const handleTestConnection = async (): Promise<void> => {
  testing.value = true
  try {
    const { provider } = buildProvider()
    await testProviderConnection({
      providerId: 'openai',
      apiKey: await resolveApiKeyForRequest(),
      baseUrl: provider.baseURL,
    })
    toast.success('Connection successful')
  } catch (error) {
    toast.error('Connection failed', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    testing.value = false
  }
}

const handleSave = (): void => {
  try {
    const { providerId, provider } = buildProvider()
    emit('save', {
      providerId,
      provider,
      apiKey: apiKeyInput.value.trim() ? apiKeyInput.value.trim() : null,
      clearApiKey: clearApiKey.value,
    })
  } catch (error) {
    toast.error('Invalid provider configuration', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="handleOpenChange">
    <DialogContent :class="dialogSurfaceClass">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
      </DialogHeader>

      <div class="max-h-[min(36rem,70vh)] min-w-0 space-y-4 overflow-x-hidden overflow-y-auto px-1 py-0.5">
        <p class="text-sm text-muted-foreground">
          Connect a private or self-hosted endpoint that speaks the OpenAI Chat Completions API.
        </p>

        <section class="space-y-3">
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="min-w-0 space-y-1.5">
              <Label for="manage-provider-name">Name</Label>
              <Input id="manage-provider-name" v-model="name" placeholder="local" :class="fieldClass" />
            </div>
            <div class="min-w-0 space-y-1.5">
              <Label for="manage-provider-base-url">Base URL</Label>
              <Input
                id="manage-provider-base-url"
                v-model="baseURL"
                placeholder="http://localhost:1234/v1"
                :class="fieldClass"
              />
            </div>
          </div>
          <p v-if="mode === 'edit'" class="text-xs text-muted-foreground">
            Provider id stays
            <code class="text-xs">{{ providerId }}</code>
            ; renaming only changes the display label.
          </p>

          <div class="min-w-0 space-y-1.5">
            <Label for="manage-provider-api-key">API key (optional)</Label>
            <SettingsInputPasswordInput
              id="manage-provider-api-key"
              v-model="apiKeyInput"
              placeholder="sk-..."
            />
            <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p class="text-xs text-muted-foreground">
                Leave blank for local servers that do not require authentication.
              </p>
              <div
                v-if="initialApiKeyConfigured"
                class="flex items-center gap-2"
              >
                <Switch
                  id="manage-provider-clear-key"
                  :checked="clearApiKey"
                  @update:checked="clearApiKey = $event"
                />
                <Label for="manage-provider-clear-key" class="text-xs font-normal">
                  Clear stored key
                </Label>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div class="flex items-center gap-2">
              <Switch
                id="manage-provider-include-usage"
                :checked="includeUsage"
                @update:checked="includeUsage = $event"
              />
              <Label for="manage-provider-include-usage" class="text-sm font-normal">
                Include usage
              </Label>
            </div>
            <div class="flex items-center gap-2">
              <Switch
                id="manage-provider-structured-outputs"
                :checked="supportsStructuredOutputs"
                @update:checked="supportsStructuredOutputs = $event"
              />
              <Label for="manage-provider-structured-outputs" class="text-sm font-normal">
                Structured outputs
              </Label>
            </div>
            <Button
              variant="outline"
              size="sm"
              class="ml-auto"
              :disabled="testing"
              @click="handleTestConnection"
            >
              <Loader2 v-if="testing" class="mr-2 h-4 w-4 animate-spin" />
              Test connection
            </Button>
          </div>
        </section>

        <Collapsible v-model:open="requestExtrasOpen" class="min-w-0">
          <CollapsibleTrigger
            class="flex w-full items-center justify-between py-1 text-left text-sm font-medium hover:underline"
          >
            Request headers & query params
            <ChevronDown
              class="h-4 w-4 shrink-0 transition-transform"
              :class="requestExtrasOpen ? 'rotate-180' : ''"
            />
          </CollapsibleTrigger>
          <CollapsibleContent class="space-y-3 pt-2">
            <div class="space-y-1.5">
              <div class="flex items-center justify-between gap-2">
                <Label>Headers</Label>
                <Button variant="ghost" size="sm" @click="addKeyValueRow(headers)">
                  <Plus class="mr-1 h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
              <div
                v-for="(row, index) in headers"
                :key="`header-${index}`"
                class="flex min-w-0 gap-2"
              >
                <Input v-model="row.key" placeholder="Header name" :class="flexFieldClass" />
                <Input v-model="row.value" placeholder="Value" :class="flexFieldClass" />
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-9 w-9 shrink-0"
                  @click="removeKeyValueRow(headers, index)"
                >
                  <Trash2 class="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div class="space-y-1.5">
              <div class="flex items-center justify-between gap-2">
                <Label>Query params</Label>
                <Button variant="ghost" size="sm" @click="addKeyValueRow(queryParams)">
                  <Plus class="mr-1 h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
              <div
                v-for="(row, index) in queryParams"
                :key="`query-${index}`"
                class="flex min-w-0 gap-2"
              >
                <Input v-model="row.key" placeholder="Param name" :class="flexFieldClass" />
                <Input v-model="row.value" placeholder="Value" :class="flexFieldClass" />
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-9 w-9 shrink-0"
                  @click="removeKeyValueRow(queryParams, index)"
                >
                  <Trash2 class="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <section class="min-w-0 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="min-w-0">
              <h3 class="text-sm font-medium">Models</h3>
              <p class="text-xs text-muted-foreground">
                Context, output limits, and sampling.
                {{
                  configuredModelCount > 0
                    ? `${configuredModelCount} configured.`
                    : 'None configured yet.'
                }}
              </p>
            </div>
            <div class="flex shrink-0 flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                :disabled="importingModels"
                @click="importModelsFromEndpoint"
              >
                <Loader2 v-if="importingModels" class="mr-1 h-3.5 w-3.5 animate-spin" />
                Import
              </Button>
              <Button variant="outline" size="sm" @click="addModel()">
                <Plus class="mr-1 h-3.5 w-3.5" />
                Add model
              </Button>
            </div>
          </div>

          <div
            v-if="models.length === 0"
            class="rounded-lg border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground"
          >
            No models configured. Add manually, import from the endpoint, or rely on live
            <code class="text-xs">/models</code>
            listing.
          </div>

          <div
            v-for="(model, index) in models"
            :key="`model-${index}`"
            class="min-w-0 space-y-3 rounded-lg border border-border/50 p-3"
          >
            <div class="flex items-center justify-between gap-2">
              <p class="text-sm font-medium">Model {{ index + 1 }}</p>
              <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                @click="removeModel(index)"
              >
                <Trash2 class="h-4 w-4" />
              </Button>
            </div>
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div class="min-w-0 space-y-1.5">
                <Label :for="`model-id-${index}`">Model ID</Label>
                <Input
                  :id="`model-id-${index}`"
                  v-model="model.id"
                  placeholder="model-id"
                  :class="fieldClass"
                />
              </div>
              <div class="min-w-0 space-y-1.5">
                <Label :for="`model-name-${index}`">Display name</Label>
                <Input
                  :id="`model-name-${index}`"
                  v-model="model.name"
                  placeholder="Optional label"
                  :class="fieldClass"
                />
              </div>
              <div class="min-w-0 space-y-1.5">
                <Label :for="`model-context-${index}`">Context window</Label>
                <Input
                  :id="`model-context-${index}`"
                  v-model="model.contextWindow"
                  inputmode="numeric"
                  placeholder="Optional"
                  :class="fieldClass"
                />
              </div>
              <div class="min-w-0 space-y-1.5">
                <Label :for="`model-max-input-${index}`">Max input</Label>
                <Input
                  :id="`model-max-input-${index}`"
                  v-model="model.maxInputTokens"
                  inputmode="numeric"
                  placeholder="128000"
                  :class="fieldClass"
                />
              </div>
              <div class="min-w-0 space-y-1.5">
                <Label :for="`model-max-output-${index}`">Max output</Label>
                <Input
                  :id="`model-max-output-${index}`"
                  v-model="model.maxOutputTokens"
                  inputmode="numeric"
                  placeholder="8192"
                  :class="fieldClass"
                />
              </div>
              <div class="flex min-w-0 flex-wrap items-end gap-x-3 gap-y-2 pb-1">
                <div class="flex items-center gap-1.5">
                  <Switch
                    :id="`model-tools-${index}`"
                    :checked="model.toolCalling"
                    @update:checked="model.toolCalling = $event"
                  />
                  <Label :for="`model-tools-${index}`" class="text-xs font-normal">Tools</Label>
                </div>
                <div class="flex items-center gap-1.5">
                  <Switch
                    :id="`model-vision-${index}`"
                    :checked="model.vision"
                    @update:checked="model.vision = $event"
                  />
                  <Label :for="`model-vision-${index}`" class="text-xs font-normal">Vision</Label>
                </div>
                <div class="flex items-center gap-1.5">
                  <Switch
                    :id="`model-thinking-${index}`"
                    :checked="model.thinking"
                    @update:checked="model.thinking = $event"
                  />
                  <Label :for="`model-thinking-${index}`" class="text-xs font-normal">
                    Thinking
                  </Label>
                </div>
                <div class="flex items-center gap-1.5">
                  <Switch
                    :id="`model-streaming-${index}`"
                    :checked="model.streaming"
                    @update:checked="model.streaming = $event"
                  />
                  <Label :for="`model-streaming-${index}`" class="text-xs font-normal">
                    Stream
                  </Label>
                </div>
              </div>
            </div>

            <Collapsible v-model:open="model.advancedOpen" class="min-w-0">
              <CollapsibleTrigger
                class="flex w-full items-center justify-between py-1 text-left text-sm font-medium hover:underline"
              >
                Advanced
                <ChevronDown
                  class="h-4 w-4 shrink-0 transition-transform"
                  :class="model.advancedOpen ? 'rotate-180' : ''"
                />
              </CollapsibleTrigger>
              <CollapsibleContent class="space-y-3 pt-2">
                <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div class="min-w-0 space-y-1.5">
                    <Label :for="`model-temp-${index}`">Temperature</Label>
                    <Input
                      :id="`model-temp-${index}`"
                      v-model="model.temperature"
                      inputmode="decimal"
                      placeholder="0.2"
                      :class="fieldClass"
                />
                  </div>
                  <div class="min-w-0 space-y-1.5">
                    <Label :for="`model-top-p-${index}`">Top P</Label>
                    <Input
                      :id="`model-top-p-${index}`"
                      v-model="model.topP"
                      inputmode="decimal"
                      placeholder="0.9"
                      :class="fieldClass"
                />
                  </div>
                  <div class="min-w-0 space-y-1.5">
                    <Label :for="`model-top-k-${index}`">Top K</Label>
                    <Input
                      :id="`model-top-k-${index}`"
                      v-model="model.topK"
                      inputmode="numeric"
                      :class="fieldClass"
                />
                  </div>
                  <div class="min-w-0 space-y-1.5">
                    <Label :for="`model-seed-${index}`">Seed</Label>
                    <Input
                      :id="`model-seed-${index}`"
                      v-model="model.seed"
                      inputmode="numeric"
                      :class="fieldClass"
                />
                  </div>
                  <div class="min-w-0 space-y-1.5">
                    <Label :for="`model-freq-${index}`">Freq. penalty</Label>
                    <Input
                      :id="`model-freq-${index}`"
                      v-model="model.frequencyPenalty"
                      inputmode="decimal"
                      :class="fieldClass"
                />
                  </div>
                  <div class="min-w-0 space-y-1.5">
                    <Label :for="`model-pres-${index}`">Pres. penalty</Label>
                    <Input
                      :id="`model-pres-${index}`"
                      v-model="model.presencePenalty"
                      inputmode="decimal"
                      :class="fieldClass"
                />
                  </div>
                  <div class="min-w-0 space-y-1.5">
                    <Label :for="`model-efforts-${index}`">Reasoning efforts</Label>
                    <Input
                      :id="`model-efforts-${index}`"
                      v-model="model.supportsReasoningEffort"
                      placeholder="none, minimal, low, medium, high, xhigh"
                      :class="fieldClass"
                />
                  </div>
                  <div class="min-w-0 space-y-1.5">
                    <Label :for="`model-effort-${index}`">Default effort</Label>
                    <Input
                      :id="`model-effort-${index}`"
                      v-model="model.reasoningEffort"
                      placeholder="provider-default, none, low, medium, high"
                      :class="fieldClass"
                />
                  </div>
                </div>
                <div class="space-y-1.5">
                  <div class="flex items-center justify-between gap-2">
                    <Label>Model headers</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      @click="addKeyValueRow(model.headers)"
                    >
                      <Plus class="mr-1 h-3.5 w-3.5" />
                      Add
                    </Button>
                  </div>
                  <div
                    v-for="(row, headerIndex) in model.headers"
                    :key="`model-header-${index}-${headerIndex}`"
                    class="flex min-w-0 gap-2"
                  >
                    <Input v-model="row.key" placeholder="Header name" :class="flexFieldClass" />
                    <Input v-model="row.value" placeholder="Value" :class="flexFieldClass" />
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-9 w-9 shrink-0"
                      @click="removeKeyValueRow(model.headers, headerIndex)"
                    >
                      <Trash2 class="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div class="min-w-0 space-y-1.5">
                  <Label :for="`model-options-${index}`">modelOptions (JSON)</Label>
                  <Textarea
                    :id="`model-options-${index}`"
                    v-model="model.modelOptionsJson"
                    class="min-h-20 w-full max-w-full font-mono text-xs focus-visible:ring-inset"
                    placeholder='{ "customOption": "value" }'
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </section>
      </div>

      <DialogFooter class="gap-2 sm:justify-end">
        <Button variant="outline" @click="handleOpenChange(false)">Cancel</Button>
        <Button @click="handleSave">
          {{ mode === 'create' ? 'Add provider' : 'Save' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
