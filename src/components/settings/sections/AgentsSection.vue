<script setup lang="ts">
import PyrolaFilesSection from '@/components/settings/sections/PyrolaFilesSection.vue'
import type { SettingsTab } from '@/composables/use-pyrola-config'

defineProps<{
  tab: SettingsTab
}>()
</script>

<template>
  <PyrolaFilesSection
    :tab="tab"
    kind="agents"
    folder-label="agents"
    title="Agents"
    empty-message="No agents yet — add .md files to .pyrola/agents/"
  />
</template>
