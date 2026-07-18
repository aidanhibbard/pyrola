<script setup lang="ts">
import { computed } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/shadcn/ui/button'
import { Input } from '@/components/shadcn/ui/input'
import { Label } from '@/components/shadcn/ui/label'
import { Slider } from '@/components/shadcn/ui/slider'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import type { SettingsTab } from '@/composables/use-pyrola-config'
import type { PyrolaTheme } from '@/types/pyrola/pyrola-settings'

type AppearanceSettingKey = 'appearance.theme' | 'appearance.fontSize'

const FONT_SIZE_MIN = 10
const FONT_SIZE_MAX = 20
const FONT_SIZE_DEFAULT = 13

const props = defineProps<{
  tab: SettingsTab
}>()

const config = usePyrolaConfig()

const settings = computed(() => config.getScopeSettings(props.tab))
const effective = computed(() => config.effectiveSettings.value)

const theme = computed(() => effective.value['appearance.theme'] ?? 'system')
const fontSize = computed(() => effective.value['appearance.fontSize'] ?? FONT_SIZE_DEFAULT)

const fontSizeSliderValue = computed(() => [fontSize.value])

const showOverrideHint = (key: AppearanceSettingKey): boolean =>
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

const setFontSize = async (value: number): Promise<void> => {
  const clamped = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(value)))
  try {
    await config.updateSetting(props.tab, 'appearance.fontSize', clamped)
  } catch (error) {
    toast.error('Failed to save font size', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const updateFontSizeFromSlider = async (value: number[] | undefined): Promise<void> => {
  const next = value?.[0]
  if (next === undefined) {
    return
  }
  await setFontSize(next)
}

const updateFontSizeFromInput = async (value: string | number): Promise<void> => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    toast.error('Font size must be a number')
    return
  }
  await setFontSize(parsed)
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

    <div class="space-y-3">
      <div class="flex items-center justify-between gap-4">
        <Label for="appearance-font-size">Font size</Label>
        <span class="text-sm text-muted-foreground">{{ fontSize }}px</span>
      </div>
      <Slider
        id="appearance-font-size"
        :model-value="fontSizeSliderValue"
        :min="FONT_SIZE_MIN"
        :max="FONT_SIZE_MAX"
        :step="1"
        @update:model-value="updateFontSizeFromSlider"
      />
      <Input
        :model-value="String(fontSize)"
        type="number"
        :min="FONT_SIZE_MIN"
        :max="FONT_SIZE_MAX"
        class="w-24"
        @update:model-value="updateFontSizeFromInput"
      />
      <p class="text-sm text-muted-foreground">Editor and terminal text size</p>
      <p v-if="showOverrideHint('appearance.fontSize')" class="text-xs text-muted-foreground">
        Using personal default ({{ settings['appearance.fontSize'] ?? FONT_SIZE_DEFAULT }}px)
      </p>
    </div>
  </section>
</template>
