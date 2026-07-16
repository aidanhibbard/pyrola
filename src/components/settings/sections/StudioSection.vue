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
    kind="studio"
    folder-label="studio"
    title="Studio"
    empty-message="No studio artifacts yet — add index.md files under .pyrola/studio/<slug>/"
  />
</template>
