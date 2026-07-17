<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Hammer } from '@lucide/vue'
import { Markdown } from 'vue-stream-markdown'
import 'vue-stream-markdown/index.css'
import { toast } from 'vue-sonner'
import { Button } from '@/components/shadcn/ui/button'
import useStartPlanBuild from '@/composables/use-start-plan-build'
import useWorkbenchStore from '@/composables/use-workbench-store'
import parsePlan from '@/services/plans/parse-plan'
import { fsReadFile } from '@/services/pyrola/pyrola-tauri'
import type { PlanPayload, PlanTodoItem, WorkbenchTab } from '@/types/workbench/workbench-tab'

const props = defineProps<{
  tab: WorkbenchTab
}>()

const workbench = useWorkbenchStore()
const { building, startPlanBuild } = useStartPlanBuild()
const body = ref('')
const todos = ref<PlanTodoItem[]>([])
const title = ref('')
const sourceChatId = ref<string | null>(null)
const loading = ref(false)

const planPayload = computed(() => props.tab.payload as PlanPayload)
const projectRoot = computed(() => workbench.getProject(props.tab.projectId)?.rootPath ?? null)
const refreshToken = computed(() => workbench.tabRefreshTokens.value[props.tab.id] ?? 0)

const loadPlan = async (): Promise<void> => {
  const root = projectRoot.value
  if (!root) {
    return
  }

  loading.value = true
  try {
    const result = await fsReadFile({ projectRoot: root, path: planPayload.value.path })
    const parsed = parsePlan(result.content)
    title.value = parsed.frontmatter.title
    body.value = parsed.body
    todos.value = parsed.frontmatter.todos
    sourceChatId.value = parsed.frontmatter.sourceChatId ?? null
  } catch (error) {
    toast.error('Failed to load plan', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    loading.value = false
  }
}

const handleBuildNow = async (): Promise<void> => {
  await startPlanBuild({
    projectId: props.tab.projectId,
    planPath: planPayload.value.path,
    planTitle: title.value || props.tab.label,
    sourceChatId: sourceChatId.value,
  })
}

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
      <Button
        size="sm"
        class="shrink-0"
        :disabled="loading || building"
        @click="handleBuildNow"
      >
        <Hammer class="mr-1.5 h-3.5 w-3.5" />
        Build now
      </Button>
    </div>

    <div v-if="todos.length > 0" class="border-b border-border/50 px-4 py-3">
      <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Todos</p>
      <ul class="space-y-1 text-sm">
        <li v-for="todo in todos" :key="todo.id" class="flex items-start gap-2">
          <span class="mt-0.5 text-xs text-muted-foreground">{{ todo.status }}</span>
          <span>{{ todo.content }}</span>
        </li>
      </ul>
    </div>

    <div class="min-h-0 flex-1 px-4 py-3 text-sm">
      <Markdown :content="body" />
    </div>
  </div>
</template>
