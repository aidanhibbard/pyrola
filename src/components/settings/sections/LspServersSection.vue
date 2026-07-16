<script setup lang="ts">
import { computed } from 'vue'
import { toast } from 'vue-sonner'
import { Label } from '@/components/shadcn/ui/label'
import { Switch } from '@/components/shadcn/ui/switch'
import SettingsSectionScroll from '@/components/settings/SettingsSectionScroll.vue'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import type { SettingsTab } from '@/composables/use-pyrola-config'

const props = defineProps<{
  tab: SettingsTab
}>()

const config = usePyrolaConfig()

const lspEnabled = computed(
  () => config.getScopeSettings(props.tab)['lsp.enabled'] ?? false,
)

const updateLspEnabled = async (value: boolean): Promise<void> => {
  try {
    await config.updateSetting(props.tab, 'lsp.enabled', value)
  } catch (error) {
    toast.error('Failed to save LSP setting', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
</script>

<template>
  <SettingsSectionScroll title="LSP">
    <div class="space-y-4">
      <div class="flex items-center justify-between gap-4">
        <div class="space-y-1">
          <Label>Enable language servers</Label>
          <p class="text-sm text-muted-foreground">
            Opt-in LSP for Monaco and harness tools. Requires binaries on PATH.
          </p>
        </div>
        <Switch :checked="lspEnabled" @update:checked="updateLspEnabled" />
      </div>

      <p class="text-sm text-muted-foreground">
        Built-in: typescript-language-server, rust-analyzer, gopls, pylsp. OpenCode-compatible config merge in v1.
      </p>
    </div>
  </SettingsSectionScroll>
</template>
