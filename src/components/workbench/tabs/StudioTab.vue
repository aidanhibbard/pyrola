<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Markdown } from 'vue-stream-markdown'
import 'vue-stream-markdown/index.css'
import { toast } from 'vue-sonner'
import useWorkbenchStore from '@/composables/use-workbench-store'
import { fsReadFile } from '@/services/pyrola/pyrola-tauri'
import type { StudioPayload, WorkbenchTab } from '@/types/workbench/workbench-tab'

const props = defineProps<{
  tab: WorkbenchTab
}>()

const workbench = useWorkbenchStore()
const content = ref('')
const loading = ref(false)

const studioPayload = computed(() => props.tab.payload as StudioPayload)
const projectRoot = computed(() => workbench.getProject(props.tab.projectId)?.rootPath ?? null)
const refreshToken = computed(() => workbench.tabRefreshTokens.value[props.tab.id] ?? 0)

const loadStudio = async (): Promise<void> => {
  const root = projectRoot.value
  if (!root) {
    return
  }

  loading.value = true
  try {
    const result = await fsReadFile({ projectRoot: root, path: studioPayload.value.path })
    content.value = result.content
  } catch (error) {
    toast.error('Failed to load studio artifact', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadStudio().catch((error) => {
    toast.error('Failed to load studio artifact', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  })
})

watch([studioPayload, projectRoot, refreshToken], () => {
  loadStudio().catch((error) => {
    toast.error('Failed to load studio artifact', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  })
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-y-auto">
    <div class="border-b border-border/50 px-4 py-3">
      <h2 class="text-sm font-semibold">{{ tab.label }}</h2>
      <p v-if="loading" class="text-xs text-muted-foreground">Loading…</p>
    </div>
    <div class="min-h-0 flex-1 px-4 py-3 text-sm">
      <Markdown :content="content" />
    </div>
  </div>
</template>
