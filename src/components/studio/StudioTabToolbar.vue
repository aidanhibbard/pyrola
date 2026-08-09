<script setup lang="ts">
import {
  Copy,
  Printer,
  RefreshCw,
} from '@lucide/vue'
import { Button } from '@/components/shadcn/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/shadcn/ui/tooltip'

const emit = defineEmits<{
  refresh: []
  copyMarkdown: []
  exportPdf: []
}>()

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
    <div class="ml-auto flex items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button variant="ghost" size="icon" class="h-8 w-8" aria-label="Refresh artifact" @click="handleRefresh">
            <RefreshCw class="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent class="z-[100]">Refresh</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button variant="ghost" size="icon" class="h-8 w-8" aria-label="Copy markdown" @click="handleCopyMarkdown">
            <Copy class="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent class="z-[100]">Copy markdown body</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button variant="ghost" size="icon" class="h-8 w-8" aria-label="Export to PDF" @click="handleExportPdf">
            <Printer class="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent class="z-[100]">Export PDF</TooltipContent>
      </Tooltip>
    </div>
  </div>
</template>
