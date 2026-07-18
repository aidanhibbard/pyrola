<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { FileText, Plus } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/shadcn/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/shadcn/ui/dropdown-menu'
import { ScrollArea } from '@/components/shadcn/ui/scroll-area'
import { Skeleton } from '@/components/shadcn/ui/skeleton'
import { pyrolaFileChangeToken } from '@/composables/use-pyrola-live-sync'
import listStudioArtifacts from '@/services/studio/list-studio-artifacts'
import type { StudioArtifactDocType } from '@/types/studio/studio-artifact'

const STUDIO_TEMPLATE_OPTIONS: Array<{ docType: StudioArtifactDocType; label: string }> = [
  { docType: 'brief', label: 'Brief' },
  { docType: 'report', label: 'Report' },
  { docType: 'rfc', label: 'RFC' },
  { docType: 'memo', label: 'Memo' },
]

const props = defineProps<{
  projectRoot: string
  activeSlug: string | null
}>()

const emit = defineEmits<{
  select: [slug: string, path: string, label?: string]
  newFromTemplate: [docType: StudioArtifactDocType]
}>()

const artifacts = ref<Awaited<ReturnType<typeof listStudioArtifacts>>>([])
const loading = ref(true)

const loadArtifacts = async (): Promise<void> => {
  loading.value = true
  try {
    artifacts.value = await listStudioArtifacts(props.projectRoot)
  } catch (error) {
    artifacts.value = []
    toast.error('Failed to load studio artifacts', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    loading.value = false
  }
}

const displayLabel = (item: (typeof artifacts.value)[number]): string =>
  item.title ?? item.slug

const isActive = (slug: string): boolean => props.activeSlug === slug

const handleSelect = (item: (typeof artifacts.value)[number]): void => {
  emit('select', item.slug, item.path, item.title ?? item.slug)
}

const handleNewFromTemplate = (docType: StudioArtifactDocType): void => {
  emit('newFromTemplate', docType)
}

onMounted(() => {
  loadArtifacts().catch((error) => {
    toast.error('Failed to load studio artifacts', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  })
})

watch(
  () => props.projectRoot,
  () => {
    loadArtifacts().catch((error) => {
      toast.error('Failed to load studio artifacts', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    })
  },
)

watch(pyrolaFileChangeToken, () => {
  loadArtifacts().catch((error) => {
    toast.error('Failed to load studio artifacts', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  })
})

const emptyMessage = computed(() =>
  loading.value ? '' : 'No studio artifacts yet. Create one from a template.',
)

defineExpose({
  reload: loadArtifacts,
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col border-r border-border/40 bg-muted/20">
    <div class="flex shrink-0 items-center justify-between gap-2 border-b border-border/40 px-3 py-2">
      <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Library</p>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="sm" class="h-7 px-2 text-xs">
            <Plus class="mr-1 h-3.5 w-3.5" />
            New
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            v-for="template in STUDIO_TEMPLATE_OPTIONS"
            :key="template.docType"
            @click="handleNewFromTemplate(template.docType)"
          >
            {{ template.label }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <ScrollArea class="min-h-0 flex-1">
      <div v-if="loading" class="space-y-2 p-3">
        <Skeleton class="h-8 w-full" />
        <Skeleton class="h-8 w-full" />
        <Skeleton class="h-8 w-5/6" />
      </div>

      <p v-else-if="artifacts.length === 0" class="px-3 py-4 text-xs leading-5 text-muted-foreground">
        {{ emptyMessage }}
      </p>

      <div v-else class="space-y-0.5 p-2">
        <button
          v-for="item in artifacts"
          :key="item.slug"
          type="button"
          class="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent"
          :class="isActive(item.slug) ? 'bg-accent text-accent-foreground' : 'text-foreground'"
          @click="handleSelect(item)"
        >
          <FileText class="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium">{{ displayLabel(item) }}</span>
            <span
              v-if="item.title"
              class="block truncate text-xs text-muted-foreground"
            >
              {{ item.slug }}
            </span>
          </span>
        </button>
      </div>
    </ScrollArea>
  </div>
</template>
