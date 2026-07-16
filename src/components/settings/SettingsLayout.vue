<script setup lang="ts">
import { computed } from 'vue'
import SettingsNav from '@/components/settings/SettingsNav.vue'
import AppearanceSection from '@/components/settings/sections/AppearanceSection.vue'
import ProvidersSection from '@/components/settings/sections/ProvidersSection.vue'
import McpServersSection from '@/components/settings/sections/McpServersSection.vue'
import FleetSection from '@/components/settings/sections/FleetSection.vue'
import GeneralSection from '@/components/settings/sections/GeneralSection.vue'
import AgentsSection from '@/components/settings/sections/AgentsSection.vue'
import PlansSection from '@/components/settings/sections/PlansSection.vue'
import StudioSection from '@/components/settings/sections/StudioSection.vue'
import SkillsSection from '@/components/settings/sections/SkillsSection.vue'
import RulesSection from '@/components/settings/sections/RulesSection.vue'
import SearchSection from '@/components/settings/sections/SearchSection.vue'
import LspServersSection from '@/components/settings/sections/LspServersSection.vue'
import { Tabs, TabsList, TabsTrigger } from '@/components/shadcn/ui/tabs'
import type { SettingsSectionId } from '@/types/settings/settings-section'
import type { SettingsTab } from '@/composables/use-pyrola-config'

const props = defineProps<{
  activeTab: SettingsTab
  activeSection: SettingsSectionId
  showProjectTab: boolean
}>()

const emit = defineEmits<{
  'update:tab': [SettingsTab]
  'update:section': [SettingsSectionId]
}>()

const sectionComponent = computed(() => {
  switch (props.activeSection) {
    case 'appearance':
      return AppearanceSection
    case 'providers':
      return ProvidersSection
    case 'mcp':
      return McpServersSection
    case 'fleet':
      return FleetSection
    case 'general':
      return GeneralSection
    case 'agents':
      return AgentsSection
    case 'plans':
      return PlansSection
    case 'studio':
      return StudioSection
    case 'skills':
      return SkillsSection
    case 'rules':
      return RulesSection
    case 'search':
      return SearchSection
    case 'lsp':
      return LspServersSection
    default:
      return GeneralSection
  }
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-6">
    <h1 class="text-2xl font-semibold tracking-tight">Settings</h1>

    <div class="flex min-h-0 flex-1 gap-6">
      <SettingsNav
        :active-tab="activeTab"
        :active-section="activeSection"
        @select="emit('update:section', $event)"
      />
      <div class="flex min-h-0 max-w-xl flex-1 flex-col overflow-hidden">
        <div class="shrink-0 pb-4">
          <div class="flex justify-end">
            <Tabs
              :model-value="activeTab"
              @update:model-value="(value) => emit('update:tab', value as SettingsTab)"
            >
              <TabsList>
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger v-if="showProjectTab" value="project">Project</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
        <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
          <component
            :is="sectionComponent"
            class="flex min-h-0 flex-1 flex-col overflow-hidden"
            :tab="activeTab"
          />
        </div>
      </div>
    </div>
  </div>
</template>
