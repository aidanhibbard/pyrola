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
    kind="skills"
    folder-label="skills"
    title="Skills"
    empty-message="No skills yet — add SKILL.md files under .pyrola/skills/"
  />
</template>
