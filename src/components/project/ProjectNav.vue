<script setup lang="ts">
import { Button } from '@/components/shadcn/ui/button'
import {
  PROJECT_SECTIONS,
  PROJECT_SECTION_LABELS,
  type ProjectSectionId,
} from '@/types/project/project-section'

defineProps<{
  activeSection: ProjectSectionId
}>()

const emit = defineEmits<{
  select: [ProjectSectionId]
}>()
</script>

<template>
  <nav class="flex shrink-0 gap-1 overflow-x-auto border-b border-border/50 pb-3">
    <Button
      v-for="section in PROJECT_SECTIONS"
      :key="section"
      variant="ghost"
      :class="activeSection === section ? 'bg-muted' : ''"
      class="shrink-0 justify-start whitespace-nowrap"
      @click="emit('select', section)"
    >
      {{ PROJECT_SECTION_LABELS[section] }}
    </Button>
  </nav>
</template>
