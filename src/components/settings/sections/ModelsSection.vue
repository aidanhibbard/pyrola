<script setup lang="ts">
import { computed } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/shadcn/ui/button'
import { Label } from '@/components/shadcn/ui/label'
import { Switch } from '@/components/shadcn/ui/switch'
import SettingsSectionScroll from '@/components/settings/SettingsSectionScroll.vue'
import ModelsSearchModelSearchPicker from '@/components/models/search/ModelSearchPicker.vue'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import type { SettingsTab } from '@/composables/use-pyrola-config'
import {
  BACKGROUND_MODEL_ROLES,
  CHAT_MODE_MODEL_ROLES,
  MODEL_ROLE_GROUP_LABELS,
  MODEL_ROLE_REGISTRY,
  type ModelRoleDefinition,
} from '@/data/model-role-registry'
import listConfiguredProviders from '@/services/providers/list-configured-providers'

const props = defineProps<{
  tab: SettingsTab
}>()

const config = usePyrolaConfig()

const settings = computed(() => config.getScopeSettings(props.tab))

const hasProviders = computed(() => listConfiguredProviders(settings.value).length > 0)

const defaultModel = computed(() => settings.value['models.default'] ?? '')

const autoTitleEnabled = computed(() => settings.value['chat.autoTitle'] !== false)

const roleModelValue = (role: ModelRoleDefinition): string =>
  settings.value[role.settingsKey] ?? ''

const isRoleOverridden = (role: ModelRoleDefinition): boolean =>
  Boolean(settings.value[role.settingsKey])

const updateModelSetting = async (
  key: ModelRoleDefinition['settingsKey'],
  value: string,
): Promise<void> => {
  if (props.tab === 'project' && !config.activeRootPath.value) {
    toast.error('Failed to save model', {
      description: 'No active project',
    })
    return
  }

  try {
    await config.updateSetting(props.tab, key, value)
    toast.success('Model saved')
  } catch (error) {
    toast.error('Failed to save model', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const clearRoleOverride = async (role: ModelRoleDefinition): Promise<void> => {
  if (props.tab === 'project' && !config.activeRootPath.value) {
    toast.error('Failed to clear override', {
      description: 'No active project',
    })
    return
  }

  try {
    await config.removeSettings(props.tab, [role.settingsKey])
    toast.success('Using default model')
  } catch (error) {
    toast.error('Failed to clear override', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const handleDefaultModelChange = async (value: string): Promise<void> => {
  await updateModelSetting('models.default', value)
}

const handleRoleModelChange = async (
  role: ModelRoleDefinition,
  value: string,
): Promise<void> => {
  await updateModelSetting(role.settingsKey, value)
}

const setAutoTitle = async (value: boolean): Promise<void> => {
  try {
    await config.updateSetting(props.tab, 'chat.autoTitle', value)
  } catch (error) {
    toast.error('Failed to save auto-title setting', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const defaultRole = MODEL_ROLE_REGISTRY.find((role) => role.id === 'default')
</script>

<template>
  <SettingsSectionScroll title="Models">
    <div
      v-if="!hasProviders"
      class="flex items-center justify-center rounded-lg border border-dashed border-border/60 px-4 py-12"
    >
      <p class="text-sm text-muted-foreground">
        Configure at least one provider before choosing models.
      </p>
    </div>

    <template v-else>
      <div class="space-y-6">
        <div v-if="defaultRole" class="space-y-2">
          <Label>{{ defaultRole.label }}</Label>
          <p class="text-sm text-muted-foreground">{{ defaultRole.description }}</p>
          <ModelsSearchModelSearchPicker
            :model-value="defaultModel"
            :scope-settings="settings"
            :disabled="!hasProviders"
            placeholder="Select default model"
            @update:model-value="handleDefaultModelChange"
          />
        </div>

        <div class="space-y-4">
          <h3 class="text-sm font-medium">{{ MODEL_ROLE_GROUP_LABELS.chatModes }}</h3>
          <div
            v-for="role in CHAT_MODE_MODEL_ROLES"
            :key="role.id"
            class="space-y-2 rounded-lg border border-border/50 px-4 py-3"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <Label>{{ role.label }}</Label>
                <p class="text-sm text-muted-foreground">{{ role.description }}</p>
              </div>
              <Button
                v-if="isRoleOverridden(role)"
                variant="ghost"
                size="sm"
                class="shrink-0"
                @click="clearRoleOverride(role)"
              >
                Use default
              </Button>
            </div>
            <ModelsSearchModelSearchPicker
              :model-value="roleModelValue(role)"
              :scope-settings="settings"
              :disabled="!hasProviders"
              :placeholder="defaultModel ? 'Using default' : 'Select model'"
              @update:model-value="handleRoleModelChange(role, $event)"
            />
          </div>
        </div>

        <div class="space-y-4">
          <h3 class="text-sm font-medium">{{ MODEL_ROLE_GROUP_LABELS.backgroundTasks }}</h3>
          <div
            v-for="role in BACKGROUND_MODEL_ROLES"
            :key="role.id"
            class="space-y-2 rounded-lg border border-border/50 px-4 py-3"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <Label>{{ role.label }}</Label>
                <p class="text-sm text-muted-foreground">{{ role.description }}</p>
              </div>
              <Button
                v-if="isRoleOverridden(role)"
                variant="ghost"
                size="sm"
                class="shrink-0"
                @click="clearRoleOverride(role)"
              >
                Use default
              </Button>
            </div>
            <div
              v-if="role.id === 'title'"
              class="flex items-center gap-3 pb-1"
            >
              <Switch
                id="auto-title"
                :model-value="autoTitleEnabled"
                @update:model-value="setAutoTitle"
              />
              <Label for="auto-title">Generate titles automatically</Label>
            </div>
            <ModelsSearchModelSearchPicker
              :model-value="roleModelValue(role)"
              :scope-settings="settings"
              :disabled="!hasProviders || (role.id === 'title' && !autoTitleEnabled)"
              :placeholder="defaultModel ? 'Using default' : 'Select model'"
              @update:model-value="handleRoleModelChange(role, $event)"
            />
          </div>
        </div>
      </div>
    </template>
  </SettingsSectionScroll>
</template>
