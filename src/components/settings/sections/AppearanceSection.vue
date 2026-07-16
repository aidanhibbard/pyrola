<script setup lang="ts">
import { computed } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/shadcn/ui/button'
import { Label } from '@/components/shadcn/ui/label'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import type { SettingsTab } from '@/composables/use-pyrola-config'
import type { PyrolaTheme } from '@/types/pyrola/pyrola-settings'

const props = defineProps<{
  tab: SettingsTab
}>()

const config = usePyrolaConfig()

const settings = computed(() => config.getScopeSettings(props.tab))
const effective = computed(() => config.effectiveSettings.value)

const theme = computed(() => effective.value['appearance.theme'] ?? 'system')

const showOverrideHint = (key: 'appearance.theme') =>
  props.tab === 'project' && config.usingPersonalDefault(key)

const setTheme = async (value: PyrolaTheme): Promise<void> => {
  try {
    await config.setTheme(props.tab, value)
  } catch (error) {
    toast.error('Failed to save theme', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
</script>

<template>
  <section class="space-y-6">
    <h2 class="text-lg font-medium">Appearance</h2>

    <div class="space-y-3">
      <Label>Theme</Label>
      <div class="flex flex-wrap gap-2">
        <Button
          v-for="option in ['light', 'dark', 'system'] as const"
          :key="option"
          :variant="theme === option ? 'default' : 'outline'"
          @click="setTheme(option)"
        >
          {{ option.charAt(0).toUpperCase() + option.slice(1) }}
        </Button>
      </div>
      <p v-if="showOverrideHint('appearance.theme')" class="text-xs text-muted-foreground">
        Using personal default ({{ settings['appearance.theme'] ?? 'system' }})
      </p>
    </div>
  </section>
</template>
