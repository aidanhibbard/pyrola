<script setup lang="ts">
import { computed } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/shadcn/ui/button'
import { Label } from '@/components/shadcn/ui/label'
import { Switch } from '@/components/shadcn/ui/switch'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import type { SettingsTab } from '@/composables/use-pyrola-config'
import type { PyrolaGlassVariant, PyrolaTheme } from '@/types/pyrola/pyrola-settings'

const props = defineProps<{
  tab: SettingsTab
}>()

const config = usePyrolaConfig()

const settings = computed(() => config.getScopeSettings(props.tab))
const effective = computed(() => config.effectiveSettings.value)

const theme = computed(() => effective.value['appearance.theme'] ?? 'system')
const glass = computed(() => effective.value['appearance.glass'] ?? true)
const glassVariant = computed(() => effective.value['appearance.glassVariant'] ?? 'dark')

const showOverrideHint = (key: 'appearance.theme' | 'appearance.glass' | 'appearance.glassVariant') =>
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

const setGlass = async (value: boolean): Promise<void> => {
  try {
    await config.setGlass(props.tab, value)
  } catch (error) {
    toast.error('Failed to save window glass setting', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const setGlassVariant = async (value: PyrolaGlassVariant): Promise<void> => {
  try {
    await config.setGlassVariant(props.tab, value)
  } catch (error) {
    toast.error('Failed to save glass variant', {
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

    <div class="space-y-2">
      <div class="flex items-center gap-3">
        <Label for="window-glass">Window glass</Label>
        <Switch
          id="window-glass"
          :model-value="glass"
          @update:model-value="setGlass"
        />
      </div>
      <p class="text-sm text-muted-foreground">Enable frosted glass / vibrancy</p>
    </div>

    <div v-if="glass" class="space-y-3">
      <Label>Glass variant</Label>
      <div class="flex flex-wrap gap-2">
        <Button
          :variant="glassVariant === 'light' ? 'default' : 'outline'"
          @click="setGlassVariant('light')"
        >
          Light glass
        </Button>
        <Button
          :variant="glassVariant === 'dark' ? 'default' : 'outline'"
          @click="setGlassVariant('dark')"
        >
          Dark glass
        </Button>
      </div>
    </div>
  </section>
</template>
