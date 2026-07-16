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
    kind="rules"
    folder-label="rules"
    title="Rules"
    empty-message="No rules yet — add .md files to .pyrola/rules/"
  />
</template>
