<script setup lang="ts">
import {
  Copy,
  FilePlus,
  PencilLine,
  Printer,
  RefreshCw,
} from '@lucide/vue'
import { Button } from '@/components/shadcn/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/shadcn/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/shadcn/ui/tooltip'
import type { StudioArtifactDocType } from '@/types/studio/studio-artifact'

type StudioTemplateOption = {
  docType: StudioArtifactDocType
  label: string
}

const STUDIO_TEMPLATE_OPTIONS: StudioTemplateOption[] = [
  { docType: 'brief', label: 'Brief' },
  { docType: 'report', label: 'Report' },
  { docType: 'rfc', label: 'RFC' },
  { docType: 'memo', label: 'Memo' },
]

defineProps<{
  sourceEditMode: boolean
}>()

const emit = defineEmits<{
  newFromTemplate: [docType: StudioArtifactDocType]
  toggleSourceEdit: []
  refresh: []
  copyMarkdown: []
  exportPdf: []
}>()

const handleNewFromTemplate = (docType: StudioArtifactDocType): void => {
  emit('newFromTemplate', docType)
}

const handleToggleSourceEdit = (): void => {
  emit('toggleSourceEdit')
}

const handleRefresh = (): void => {
  emit('refresh')
}

const handleCopyMarkdown = (): void => {
  emit('copyMarkdown')
}

const handleExportPdf = (): void => {
  emit('exportPdf')
}
</script>

<template>
  <div class="flex shrink-0 items-center gap-0.5 border-b border-border/40 px-2 py-1">
    <Tooltip>
      <DropdownMenu>
        <TooltipTrigger as-child>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="icon" class="h-8 w-8" aria-label="New studio artifact">
              <FilePlus class="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            v-for="template in STUDIO_TEMPLATE_OPTIONS"
            :key="template.docType"
            @click="handleNewFromTemplate(template.docType)"
          >
            {{ template.label }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <TooltipContent>New from template</TooltipContent>
    </Tooltip>

    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8"
          :class="sourceEditMode ? 'bg-accent text-accent-foreground' : ''"
          aria-label="Edit source"
          @click="handleToggleSourceEdit"
        >
          <PencilLine class="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ sourceEditMode ? 'Preview only' : 'Edit source' }}</TooltipContent>
    </Tooltip>

    <Tooltip>
      <TooltipTrigger as-child>
        <Button variant="ghost" size="icon" class="h-8 w-8" aria-label="Refresh artifact" @click="handleRefresh">
          <RefreshCw class="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Refresh</TooltipContent>
    </Tooltip>

    <Tooltip>
      <TooltipTrigger as-child>
        <Button variant="ghost" size="icon" class="h-8 w-8" aria-label="Copy markdown" @click="handleCopyMarkdown">
          <Copy class="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Copy markdown body</TooltipContent>
    </Tooltip>

    <div class="ml-auto">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button variant="ghost" size="icon" class="h-8 w-8" aria-label="Export to PDF" @click="handleExportPdf">
            <Printer class="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Export PDF</TooltipContent>
      </Tooltip>
    </div>
  </div>
</template>
