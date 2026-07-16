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
  <nav class="flex w-48 shrink-0 flex-col gap-1">
    <Button
      v-for="section in sections"
      :key="section"
      variant="ghost"
      :class="activeSection === section ? 'bg-muted' : ''"
      class="justify-start"
      @click="emit('select', section)"
    >
      {{ SECTION_LABELS[section] }}
    </Button>
  </nav>
</template>
