<script setup lang="ts">
import { computed } from 'vue'
import { toast } from 'vue-sonner'
import { Label } from '@/components/shadcn/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/ui/select'
import { Input } from '@/components/shadcn/ui/input'
import SettingsSectionScroll from '@/components/settings/SettingsSectionScroll.vue'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import type { SettingsTab } from '@/composables/use-pyrola-config'
import type { PyrolaSearchProvider } from '@/types/pyrola/pyrola-settings'

const props = defineProps<{
  tab: SettingsTab
}>()

const config = usePyrolaConfig()

const provider = computed(
  () => config.getScopeSettings(props.tab)['search.provider'] ?? 'tavily',
)

const apiKeyRef = computed(
  () => config.getScopeSettings(props.tab)['search.apiKeyRef'] ?? '',
)

const customBaseUrl = computed(
  () => config.getScopeSettings(props.tab)['search.customBaseUrl'] ?? '',
)

const updateProvider = async (value: unknown): Promise<void> => {
  if (typeof value !== 'string') {
    return
  }
  try {
    await config.updateSetting(props.tab, 'search.provider', value as PyrolaSearchProvider)
  } catch (error) {
    toast.error('Failed to save search provider', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const updateApiKeyRef = async (value: string | number): Promise<void> => {
  try {
    await config.updateSetting(props.tab, 'search.apiKeyRef', String(value))
  } catch (error) {
    toast.error('Failed to save API key reference', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const updateCustomBaseUrl = async (value: string | number): Promise<void> => {
  try {
    await config.updateSetting(props.tab, 'search.customBaseUrl', String(value))
  } catch (error) {
    toast.error('Failed to save custom base URL', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
</script>

<template>
  <SettingsSectionScroll title="Search">
    <div class="space-y-4">
      <div class="space-y-2">
        <Label>Provider</Label>
        <Select :model-value="provider" @update:model-value="updateProvider">
          <SelectTrigger>
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tavily">Tavily</SelectItem>
            <SelectItem value="brave">Brave</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="space-y-2">
        <Label>API key reference</Label>
        <Input :model-value="apiKeyRef" @update:model-value="updateApiKeyRef" />
        <p class="text-sm text-muted-foreground">Keychain reference for BYOK web search</p>
      </div>

      <div v-if="provider === 'custom'" class="space-y-2">
        <Label>Custom base URL</Label>
        <Input :model-value="customBaseUrl" @update:model-value="updateCustomBaseUrl" />
      </div>
    </div>
  </SettingsSectionScroll>
</template>
