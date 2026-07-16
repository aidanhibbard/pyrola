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
    kind="plans"
    folder-label="plans"
    title="Plans"
    empty-message="No plans yet — add PLAN.md files under .pyrola/plans/<name>/"
  />
</template>
