<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { toast } from 'vue-sonner'
import StudioArtifactLibrary from '@/components/studio/StudioArtifactLibrary.vue'
import StudioRenderer from '@/components/studio/StudioRenderer.vue'
import StudioSourceEditor from '@/components/studio/StudioSourceEditor.vue'
import StudioTabToolbar from '@/components/studio/StudioTabToolbar.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/shadcn/ui/alert'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/shadcn/ui/resizable'
import { Skeleton } from '@/components/shadcn/ui/skeleton'
import useStudioRenderer from '@/composables/use-studio-renderer'
import useWorkbenchStore from '@/composables/use-workbench-store'
import listStudioArtifacts from '@/services/studio/list-studio-artifacts'
import { fsWriteFile } from '@/services/pyrola/pyrola-tauri'
import validateStudioSlug from '@/services/studio/validate-studio-slug'
import type { StudioArtifactDocType } from '@/types/studio/studio-artifact'
import type { StudioPayload, WorkbenchTab } from '@/types/workbench/workbench-tab'

const templateModules = import.meta.glob('@/studio/templates/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const props = defineProps<{
  tab: WorkbenchTab
}>()

const workbench = useWorkbenchStore()
const libraryRef = ref<InstanceType<typeof StudioArtifactLibrary> | null>(null)

const studioPayload = computed(() => props.tab.payload as StudioPayload)
const projectRoot = computed(() => workbench.getProject(props.tab.projectId)?.rootPath ?? null)
const artifactPath = computed(() => studioPayload.value.path)
const activeSlug = computed(() => studioPayload.value.artifactSlug)
const refreshToken = computed(() => workbench.tabRefreshTokens.value[props.tab.id] ?? 0)

const sourceEditMode = ref(false)
const sourceContent = ref('')
const isSaving = ref(false)
const isSourceDirty = ref(false)

const {
  markdown,
  renderMarkdown,
  data,
  frontmatter,
  loading,
  parseError,
  reload,
  applySourceContent,
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
  return parts.join(' · ')
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

const resolveTemplateContent = (docType: StudioArtifactDocType): string => {
  const suffix = `/studio/templates/${docType}.md`
  const moduleKey = Object.keys(templateModules).find((path) => path.endsWith(suffix))
  if (!moduleKey) {
    throw new Error(`Studio template not found: ${docType}`)
  }
  return templateModules[moduleKey]!
}

const generateSlug = async (docType: StudioArtifactDocType): Promise<string> => {
  const root = projectRoot.value
  if (!root) {
    throw new Error('No project root available')
  }

  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const existing = await listStudioArtifacts(root)
  const existingSlugs = new Set(existing.map((item) => item.slug))

  let candidate = `${docType}-${datePart}`
  let suffix = 2
  while (existingSlugs.has(candidate)) {
    candidate = `${docType}-${datePart}-${suffix}`
    suffix += 1
  }

  const slugError = validateStudioSlug(candidate)
  if (slugError) {
    throw new Error(slugError)
  }

  return candidate
}

const saveSourceContent = async (content: string): Promise<void> => {
  const root = projectRoot.value
  const path = artifactPath.value
  if (!root || !path || !isSourceDirty.value) {
    return
  }

  isSaving.value = true
  try {
    await fsWriteFile({ projectRoot: root, path, content })
    isSourceDirty.value = false
    workbench.refreshPlanStudioTabs()
  } catch (error) {
    toast.error('Failed to save studio artifact', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    isSaving.value = false
  }
}

const debouncedPreview = useDebounceFn(async (content: string) => {
  try {
    await applySourceContent(content)
  } catch (error) {
    toast.error('Failed to update preview', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}, 300)

const debouncedSave = useDebounceFn(async (content: string) => {
  await saveSourceContent(content)
}, 1000)

const handleSourceUpdate = (content: string): void => {
  sourceContent.value = content
  isSourceDirty.value = true
  debouncedPreview(content).catch((error) => {
    toast.error('Failed to update preview', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  })
  debouncedSave(content).catch((error) => {
    toast.error('Failed to save studio artifact', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  })
}

const handleSelectArtifact = (slug: string, path: string, label?: string): void => {
  try {
    workbench.openStudio(props.tab.projectId, slug, path, label)
  } catch (error) {
    toast.error('Failed to open studio artifact', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const handleNewFromTemplate = async (docType: StudioArtifactDocType): Promise<void> => {
  const root = projectRoot.value
  if (!root) {
    toast.error('No project selected')
    return
  }

  try {
    const slug = await generateSlug(docType)
    const path = `.pyrola/studio/${slug}/index.md`
    const content = resolveTemplateContent(docType)
    await fsWriteFile({ projectRoot: root, path, content })
    const titleMatch = content.match(/^---[\s\S]*?title:\s*(.+)$/m)?.[1]?.trim()
    workbench.openStudio(props.tab.projectId, slug, path, titleMatch ?? slug)
    workbench.refreshPlanStudioTabs()
    await libraryRef.value?.reload()
    toast.success('Studio artifact created')
  } catch (error) {
    toast.error('Failed to create studio artifact', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const handleToggleSourceEdit = (): void => {
  sourceEditMode.value = !sourceEditMode.value
}

const handleRefresh = async (): Promise<void> => {
  try {
    await reload()
    await libraryRef.value?.reload()
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

watch(artifactPath, () => {
  isSourceDirty.value = false
})

watch(markdown, (content) => {
  if (!isSourceDirty.value) {
    sourceContent.value = content
  }
})
</script>

<template>
  <ResizablePanelGroup
    direction="horizontal"
    class="studio-artifact-root h-full min-h-0 overflow-hidden"
  >
    <ResizablePanel
      v-if="projectRoot"
      :default-size="22"
      :min-size="16"
      :max-size="32"
      class="min-h-0 min-w-0 overflow-hidden"
    >
      <StudioArtifactLibrary
        ref="libraryRef"
        :project-root="projectRoot"
        :active-slug="activeSlug"
        @select="handleSelectArtifact"
        @new-from-template="handleNewFromTemplate"
      />
    </ResizablePanel>

    <ResizableHandle v-if="projectRoot" />

    <ResizablePanel
      :default-size="78"
      :min-size="50"
      class="min-h-0 min-w-0 overflow-hidden"
    >
      <div class="flex h-full min-h-0 flex-col overflow-hidden">
        <StudioTabToolbar
          v-if="showToolbar"
          :source-edit-mode="sourceEditMode"
          @new-from-template="handleNewFromTemplate"
          @toggle-source-edit="handleToggleSourceEdit"
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

          <div
            class="flex min-h-0 flex-1 overflow-hidden"
            :class="sourceEditMode ? 'flex-row' : 'flex-col'"
          >
            <div
              v-if="sourceEditMode"
              class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-r border-border/40"
            >
              <div class="flex shrink-0 items-center justify-between border-b border-border/40 px-3 py-1.5">
                <p class="text-xs font-medium text-muted-foreground">Source</p>
                <p v-if="isSaving" class="text-xs text-muted-foreground">Saving…</p>
              </div>
              <div class="min-h-0 flex-1 overflow-hidden">
                <StudioSourceEditor
                  :model-value="sourceContent"
                  @update:model-value="handleSourceUpdate"
                />
              </div>
            </div>

            <article
              v-if="!parseError || sourceEditMode"
              class="min-h-0 overflow-y-auto"
              :class="sourceEditMode ? 'min-w-0 flex-1' : 'flex-1'"
            >
              <div class="mx-auto w-full max-w-3xl px-5 py-8">
                <header v-if="showMasthead && !sourceEditMode" class="mb-10 space-y-3">
                  <h1 class="text-[28px] font-semibold tracking-tight leading-tight text-foreground">
                    {{ displayTitle }}
                  </h1>
                  <p v-if="frontmatter.subtitle" class="text-base leading-7 text-muted-foreground">
                    {{ frontmatter.subtitle }}
                  </p>
                  <p v-if="mastheadMeta" class="text-xs text-muted-foreground">{{ mastheadMeta }}</p>
                </header>
                <StudioRenderer v-if="!parseError" :markdown="renderMarkdown" :data="data" />
              </div>
            </article>
          </div>
        </div>
      </div>
    </ResizablePanel>
  </ResizablePanelGroup>
</template>
