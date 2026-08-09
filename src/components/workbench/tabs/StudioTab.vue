<script setup lang="ts">
import { computed } from 'vue'
import { toast } from 'vue-sonner'
import StudioRenderer from '@/components/studio/StudioRenderer.vue'
import StudioTabToolbar from '@/components/studio/StudioTabToolbar.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/shadcn/ui/alert'
import { Skeleton } from '@/components/shadcn/ui/skeleton'
import useStudioRenderer from '@/composables/use-studio-renderer'
import useWorkbenchStore from '@/composables/use-workbench-store'
import type { StudioPayload, WorkbenchTab } from '@/types/workbench/workbench-tab'

const props = defineProps<{
  tab: WorkbenchTab
}>()

const workbench = useWorkbenchStore()

const studioPayload = computed(() => props.tab.payload as StudioPayload)
const projectRoot = computed(() => workbench.getProject(props.tab.projectId)?.rootPath ?? null)
const artifactPath = computed(() => studioPayload.value.path)
const refreshToken = computed(() => workbench.tabRefreshTokens.value[props.tab.id] ?? 0)

const {
  renderMarkdown,
  data,
  frontmatter,
  loading,
  parseError,
  reload,
} = useStudioRenderer(projectRoot, artifactPath, refreshToken)

const displayTitle = computed(
  () => frontmatter.value.title ?? props.tab.label ?? studioPayload.value.artifactSlug,
)

const mastheadMeta = computed(() => {
  const parts: string[] = []
  if (frontmatter.value.dateRange) {
    parts.push(frontmatter.value.dateRange)
  }
  if (frontmatter.value.source) {
    parts.push(frontmatter.value.source)
  }
  return parts.join(', ')
})

const showMasthead = computed(
  () =>
    Boolean(
      displayTitle.value ||
        frontmatter.value.subtitle ||
        mastheadMeta.value,
    ),
)

const showToolbar = computed(() => Boolean(projectRoot.value && !loading.value))

const handleRefresh = async (): Promise<void> => {
  try {
    await reload()
  } catch (error) {
    toast.error('Failed to refresh studio artifact', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const handleCopyMarkdown = async (): Promise<void> => {
  try {
    await navigator.clipboard.writeText(renderMarkdown.value)
    toast.success('Markdown body copied')
  } catch (error) {
    toast.error('Failed to copy markdown', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const handleExportPdf = (): void => {
  try {
    document.documentElement.classList.add('studio-print')
    window.print()
    window.setTimeout(() => {
      document.documentElement.classList.remove('studio-print')
    }, 0)
  } catch (error) {
    toast.error('Failed to export PDF', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden">
    <StudioTabToolbar
      v-if="showToolbar"
      @refresh="handleRefresh"
      @copy-markdown="handleCopyMarkdown"
      @export-pdf="handleExportPdf"
    />

    <div v-if="loading" class="space-y-3 overflow-y-auto px-5 py-8">
      <Skeleton class="h-8 w-56" />
      <Skeleton class="h-4 w-full max-w-xl" />
      <Skeleton class="h-4 w-full max-w-lg" />
      <Skeleton class="h-28 w-full" />
    </div>

    <div
      v-if="!loading"
      class="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <Alert v-if="parseError" variant="destructive" class="mx-5 mt-4 shrink-0">
        <AlertTitle>Unsupported studio artifact</AlertTitle>
        <AlertDescription>{{ parseError }}</AlertDescription>
      </Alert>

      <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <article
          v-if="!parseError"
          class="min-h-0 flex-1 overflow-y-auto"
        >
          <div class="mx-auto w-full max-w-3xl px-5 py-8">
            <header v-if="showMasthead" class="mb-10 space-y-3">
              <h1 class="text-[28px] font-semibold tracking-tight leading-tight text-foreground">
                {{ displayTitle }}
              </h1>
              <p v-if="frontmatter.subtitle" class="text-base leading-7 text-muted-foreground">
                {{ frontmatter.subtitle }}
              </p>
              <p v-if="mastheadMeta" class="text-xs text-muted-foreground">{{ mastheadMeta }}</p>
            </header>
            <StudioRenderer :markdown="renderMarkdown" :data="data" />
          </div>
        </article>
      </div>
    </div>
  </div>
</template>
