<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/shadcn/ui/button'
import {
  PERSONAL_SECTIONS,
  PROJECT_SECTIONS,
  SECTION_LABELS,
  type SettingsSectionId,
} from '@/types/settings/settings-section'
import type { SettingsTab } from '@/composables/use-pyrola-config'

const props = defineProps<{
  activeTab: SettingsTab
  activeSection: SettingsSectionId
}>()

const emit = defineEmits<{
  select: [SettingsSectionId]
}>()

const sections = computed(() =>
  props.activeTab === 'personal' ? PERSONAL_SECTIONS : PROJECT_SECTIONS,
)
</script>

<template>
  <nav class="flex shrink-0 gap-1 overflow-x-auto md:w-48 md:flex-col md:overflow-x-visible">
    <Button
      v-for="section in sections"
      :key="section"
      variant="ghost"
      :class="activeSection === section ? 'bg-muted' : ''"
      class="shrink-0 justify-start whitespace-nowrap"
      @click="emit('select', section)"
    >
      {{ SECTION_LABELS[section] }}
    </Button>
  </nav>
</template>
