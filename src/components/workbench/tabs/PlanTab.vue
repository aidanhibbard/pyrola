<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Hammer } from '@lucide/vue'
import { Markdown } from 'vue-stream-markdown'
import 'vue-stream-markdown/index.css'
import { toast } from 'vue-sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/shadcn/ui/alert'
import { Badge } from '@/components/shadcn/ui/badge'
import { Button } from '@/components/shadcn/ui/button'
import ModelsSearchModelSearchPicker from '@/components/models/search/ModelSearchPicker.vue'
import StudioBlocksMermaid from '@/components/studio/blocks/StudioBlocksMermaid.vue'
import useFleetRegistry from '@/composables/use-fleet-registry'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import useStartPlanBuild from '@/composables/use-start-plan-build'
import useWorkbenchStore from '@/composables/use-workbench-store'
import parsePlan from '@/services/plans/parse-plan'
import listConfiguredProviders from '@/services/providers/list-configured-providers'
import resolveModelForRole from '@/services/models/resolve-model-for-role'
import { fsReadFile } from '@/services/pyrola/pyrola-tauri'
import type { PlanTodoItem } from '@/types/plans/plan-document'
import type { PlanPayload, WorkbenchTab } from '@/types/workbench/workbench-tab'

type PlanBodySegment =
  | { type: 'markdown'; content: string }
  | { type: 'mermaid'; content: string }

const MERMAID_FENCE_RE = /```mermaid\s*\n([\s\S]*?)```/g

const props = defineProps<{
  tab: WorkbenchTab
}>()

const router = useRouter()
const workbench = useWorkbenchStore()
const fleet = useFleetRegistry()
const config = usePyrolaConfig()
const { building, startPlanBuild } = useStartPlanBuild()
const body = ref('')
const todos = ref<PlanTodoItem[]>([])
const title = ref('')
const sourceChatId = ref<string | null>(null)
const lastBuildChatId = ref<string | null>(null)
const selectedModel = ref('')
const loading = ref(false)
const parseError = ref<string | null>(null)

const planPayload = computed(() => props.tab.payload as PlanPayload)
const projectRoot = computed(() => workbench.getProject(props.tab.projectId)?.rootPath ?? null)
const projectSlug = computed(
  () => fleet.projects.value.find((project) => project.id === props.tab.projectId)?.slug ?? null,
)
const refreshToken = computed(() => workbench.tabRefreshTokens.value[props.tab.id] ?? 0)

const hasProviders = computed(
  () => listConfiguredProviders(config.effectiveSettings.value).length > 0,
)

const allTodosDone = computed(
  () =>
    todos.value.length > 0 &&
    todos.value.every(
      (todo) => todo.status === 'completed' || todo.status === 'cancelled',
    ),
)

const bodySegments = computed((): PlanBodySegment[] => {
  const text = body.value
  if (!text.trim()) {
    return []
  }

  const segments: PlanBodySegment[] = []
  let lastIndex = 0

  for (const match of text.matchAll(MERMAID_FENCE_RE)) {
    const start = match.index ?? 0
    if (start > lastIndex) {
      segments.push({ type: 'markdown', content: text.slice(lastIndex, start) })
    }
    segments.push({ type: 'mermaid', content: match[1] ?? '' })
    lastIndex = start + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'markdown', content: text.slice(lastIndex) })
  }

  if (segments.length === 0) {
    return [{ type: 'markdown', content: text }]
  }

  return segments
})

const resolveDefaultModel = (lastBuildModel?: string): string => {
  if (lastBuildModel?.trim()) {
    return lastBuildModel.trim()
  }
  return resolveModelForRole('agent', config.effectiveSettings.value) ?? ''
}

const loadPlan = async (): Promise<void> => {
  const root = projectRoot.value
  if (!root) {
    return
  }

  loading.value = true
  parseError.value = null
  try {
    const result = await fsReadFile({ projectRoot: root, path: planPayload.value.path })
    const parsed = parsePlan(result.content)
    if (parsed.parseError) {
      parseError.value = parsed.parseError
      title.value = props.tab.label
      body.value = parsed.body
      todos.value = []
      sourceChatId.value = null
      lastBuildChatId.value = null
      return
    }

    title.value = parsed.frontmatter?.title ?? props.tab.label
    body.value = parsed.body
    todos.value = parsed.frontmatter?.todos ?? []
    sourceChatId.value = parsed.frontmatter?.sourceChatId ?? null
    lastBuildChatId.value = parsed.frontmatter?.lastBuildChatId ?? null
    selectedModel.value = resolveDefaultModel(parsed.frontmatter?.lastBuildModel)
  } catch (error) {
    toast.error('Failed to load plan', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    loading.value = false
  }
}

const handleModelChange = (value: string): void => {
  if (value.length > 0) {
    selectedModel.value = value
  }
}

const handleOpenBuiltChat = async (): Promise<void> => {
  const slug = projectSlug.value
  const chatId = lastBuildChatId.value
  if (!slug || !chatId) {
    return
  }

  try {
    await router.push(`/project/${slug}/chat/${chatId}`)
  } catch (error) {
    toast.error('Could not open build chat', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const handleBuildNow = async (): Promise<void> => {
  if (!selectedModel.value) {
    toast.error('Select a model before building')
    return
  }

  const success = await startPlanBuild({
    projectId: props.tab.projectId,
    planPath: planPayload.value.path,
    planTitle: title.value || props.tab.label,
    sourceChatId: sourceChatId.value,
    model: selectedModel.value,
  })

  if (success) {
    await loadPlan()
  }
}

watch(
  () => config.hydrated.value,
  (hydrated) => {
    if (!hydrated || selectedModel.value) {
      return
    }
    const resolved = resolveDefaultModel()
    if (resolved) {
      selectedModel.value = resolved
    }
  },
  { immediate: true },
)

onMounted(() => {
  loadPlan().catch((error) => {
    toast.error('Failed to load plan', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  })
})

watch([planPayload, projectRoot, refreshToken], () => {
  loadPlan().catch((error) => {
    toast.error('Failed to load plan', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  })
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-y-auto">
    <div class="flex items-start justify-between gap-3 border-b border-border/50 px-4 py-3">
      <div class="min-w-0">
        <h2 class="text-sm font-semibold">{{ title || tab.label }}</h2>
        <p v-if="loading" class="text-xs text-muted-foreground">Loading…</p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <button
          v-if="lastBuildChatId"
          type="button"
          class="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          @click="handleOpenBuiltChat"
        >
          Built
        </button>
        <Badge v-if="allTodosDone" variant="secondary" class="pointer-events-none opacity-70">
          Done
        </Badge>
        <template v-else>
          <ModelsSearchModelSearchPicker
            :model-value="selectedModel"
            compact
            :disabled="!hasProviders || loading || building || Boolean(parseError)"
            placeholder="Select model"
            @update:model-value="handleModelChange"
          />
          <Button
            size="sm"
            :disabled="
              loading ||
              building ||
              Boolean(parseError) ||
              !selectedModel ||
              !hasProviders
            "
            @click="handleBuildNow"
          >
            <Hammer class="mr-1.5 h-3.5 w-3.5" />
            Build now
          </Button>
        </template>
      </div>
    </div>

    <Alert v-if="parseError" variant="destructive" class="m-4">
      <AlertTitle>Invalid plan document</AlertTitle>
      <AlertDescription>{{ parseError }}</AlertDescription>
    </Alert>

    <template v-else>
      <div v-if="todos.length > 0" class="border-b border-border/50 px-4 py-3">
        <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Todos</p>
        <ul class="space-y-1 text-sm">
          <li v-for="todo in todos" :key="todo.id" class="flex items-start gap-2">
            <span class="mt-0.5 text-xs text-muted-foreground">{{ todo.status }}</span>
            <span>{{ todo.content }}</span>
          </li>
        </ul>
      </div>

      <div class="min-h-0 flex-1 space-y-4 px-4 py-3 text-sm">
        <template v-for="(segment, index) in bodySegments" :key="index">
          <Markdown
            v-if="segment.type === 'markdown' && segment.content.trim()"
            :content="segment.content"
          />
          <StudioBlocksMermaid v-else-if="segment.type === 'mermaid'" :code="segment.content" />
        </template>
      </div>
    </template>
  </div>
</template>
