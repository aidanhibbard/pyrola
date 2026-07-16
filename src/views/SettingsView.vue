<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import SettingsLayout from '@/components/settings/SettingsLayout.vue'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import type { SettingsSectionId } from '@/types/settings/settings-section'
import { PERSONAL_SECTIONS, PROJECT_SECTIONS } from '@/types/settings/settings-section'
import type { SettingsTab } from '@/composables/use-pyrola-config'

const route = useRoute()
const router = useRouter()
const config = usePyrolaConfig()

const resolveSection = (tab: SettingsTab, section: SettingsSectionId): SettingsSectionId => {
  const allowed = tab === 'personal' ? PERSONAL_SECTIONS : PROJECT_SECTIONS
  return allowed.includes(section) ? section : allowed[0]!
}

const activeTab = computed<SettingsTab>(() =>
  route.query.tab === 'project' ? 'project' : 'personal',
)

const activeSection = computed<SettingsSectionId>(() => {
  const section = route.query.section
  if (typeof section === 'string') {
    return resolveSection(activeTab.value, section as SettingsSectionId)
  }
  return activeTab.value === 'project' ? PROJECT_SECTIONS[0]! : 'general'
})

const setTab = async (tab: SettingsTab): Promise<void> => {
  try {
    await router.replace({
      path: '/settings',
      query: { tab, section: resolveSection(tab, activeSection.value) },
    })
  } catch (error) {
    toast.error('Navigation failed', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const setSection = async (section: SettingsSectionId): Promise<void> => {
  try {
    await router.replace({
      path: '/settings',
      query: { tab: activeTab.value, section },
    })
  } catch (error) {
    toast.error('Navigation failed', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

watch(
  [() => config.hydrated.value, () => config.showProjectTab.value, () => route.query.tab],
  async ([hydrated, showProject, tabQuery]) => {
    if (!hydrated) {
      return
    }

    if (!showProject && tabQuery === 'project') {
      await setTab('personal')
      return
    }

    if (showProject && tabQuery === undefined) {
      try {
        await router.replace({
          path: '/settings',
          query: {
            tab: 'project',
            section: resolveSection('project', activeSection.value),
          },
        })
      } catch (error) {
        toast.error('Navigation failed', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  },
  { immediate: true },
)

const onKeydown = async (event: KeyboardEvent): Promise<void> => {
  if (event.key === 'Escape') {
    try {
      await router.push('/')
    } catch (error) {
      toast.error('Navigation failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  try {
    await config.refreshAll()
  } catch (error) {
    toast.error('Failed to load settings', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div v-if="!config.hydrated.value" class="flex h-full items-center justify-center p-8">
    <p class="text-sm text-muted-foreground">Loading settings…</p>
  </div>
  <div v-else class="flex h-full min-h-0 flex-1 flex-col">
    <SettingsLayout
      :active-tab="activeTab"
      :active-section="activeSection"
      :show-project-tab="config.showProjectTab.value"
      @update:tab="setTab"
      @update:section="setSection"
    />
  </div>
</template>
