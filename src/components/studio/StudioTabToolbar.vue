<script setup lang="ts">
import { Printer } from '@lucide/vue'
import { Button } from '@/components/shadcn/ui/button'

const emit = defineEmits<{
  exportPdf: []
}>()

const handleExport = (): void => {
  emit('exportPdf')
}
</script>

<template>
  <div class="flex shrink-0 justify-end border-b border-border/40 px-2 py-1">
    <Button variant="ghost" size="icon" class="h-8 w-8" aria-label="Export to PDF" @click="handleExport">
      <Printer class="h-4 w-4" />
    </Button>
  </div>
</template>
