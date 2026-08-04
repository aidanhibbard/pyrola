<script setup lang="ts">
import { computed } from 'vue'
import { toast } from 'vue-sonner'
import type { AcceptableValue } from 'reka-ui'
import { Label } from '@/components/shadcn/ui/label'
import { Switch } from '@/components/shadcn/ui/switch'
import { Textarea } from '@/components/shadcn/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/ui/select'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import type { PyrolaChatMode } from '@/types/pyrola/pyrola-settings'

const config = usePyrolaConfig()

const maxAgents = computed(() =>
  String(config.personalSettings.value['fleet.maxConcurrentAgents'] ?? 4),
)

const defaultMode = computed(
  () => config.personalSettings.value['agent.defaultMode'] ?? 'agent',
)

const trayBackground = computed(
  () => config.personalSettings.value['fleet.trayBackground'] ?? false,
)

const updateMaxAgents = async (value: AcceptableValue): Promise<void> => {
  if (typeof value !== 'string') {
    return
  }
  try {
    await config.setMaxConcurrentAgents(Number(value))
  } catch (error) {
    toast.error('Failed to save max concurrent agents', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const updateDefaultMode = async (value: AcceptableValue): Promise<void> => {
  if (typeof value !== 'string') {
    return
  }
  try {
    await config.setDefaultMode(value as PyrolaChatMode)
  } catch (error) {
    toast.error('Failed to save default chat mode', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const setTrayBackground = async (value: boolean): Promise<void> => {
  try {
    await config.setTrayBackground(value)
  } catch (error) {
    toast.error('Failed to save background agents setting', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const browserEnabled = computed(
  () => config.personalSettings.value['agent.browser.enabled'] ?? false,
)

const allowedDomainsText = computed(
  () => (config.personalSettings.value['agent.browser.allowedDomains'] ?? []).join('\n'),
)

const deniedDomainsText = computed(
  () => (config.personalSettings.value['agent.browser.deniedDomains'] ?? []).join('\n'),
)

const setBrowserEnabled = async (value: boolean): Promise<void> => {
  try {
    await config.updateSetting('personal', 'agent.browser.enabled', value)
  } catch (error) {
    toast.error('Failed to save browser setting', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const parseDomainLines = (value: string): string[] =>
  value
    .split(/[\n,]+/)
    .map((line) => line.trim())
    .filter(Boolean)

const saveAllowedDomains = async (value: string | number): Promise<void> => {
  try {
    await config.updateSetting(
      'personal',
      'agent.browser.allowedDomains',
      parseDomainLines(String(value)),
    )
  } catch (error) {
    toast.error('Failed to save allowed domains', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const saveDeniedDomains = async (value: string | number): Promise<void> => {
  try {
    await config.updateSetting(
      'personal',
      'agent.browser.deniedDomains',
      parseDomainLines(String(value)),
    )
  } catch (error) {
    toast.error('Failed to save denied domains', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
</script>

<template>
  <section class="space-y-6">
    <h2 class="text-lg font-medium">Fleet</h2>

    <div class="space-y-2">
      <Label>Max concurrent agents</Label>
      <Select :model-value="maxAgents" @update:model-value="updateMaxAgents">
        <SelectTrigger class="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="n in 16" :key="n" :value="String(n)">{{ n }}</SelectItem>
        </SelectContent>
      </Select>
      <p class="text-sm text-muted-foreground">Agents running in parallel across projects</p>
    </div>

    <div class="space-y-2">
      <div class="flex items-center gap-3">
        <Label for="tray-background">Background agents</Label>
        <Switch
          id="tray-background"
          :model-value="trayBackground"
          @update:model-value="setTrayBackground"
        />
      </div>
      <p class="text-sm text-muted-foreground">
        Keep agents running when the window is closed.
      </p>
    </div>

    <div class="space-y-2">
      <Label>Default chat mode</Label>
      <Select :model-value="defaultMode" @update:model-value="updateDefaultMode">
        <SelectTrigger class="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ask">Ask</SelectItem>
          <SelectItem value="plan">Plan</SelectItem>
          <SelectItem value="studio">Studio</SelectItem>
          <SelectItem value="agent">Agent</SelectItem>
          <SelectItem value="orchestrator">Orchestrator</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="space-y-4 border-t border-border/50 pt-6">
      <h3 class="text-sm font-medium">Browser agent</h3>
      <div class="space-y-2">
        <div class="flex items-center gap-3">
          <Label for="browser-enabled">Enable browser tools</Label>
          <Switch
            id="browser-enabled"
            :model-value="browserEnabled"
            @update:model-value="setBrowserEnabled"
          />
        </div>
        <p class="text-sm text-muted-foreground">
          Shared app-global embedded browser for agents (same pane as the workbench Browser tab).
        </p>
      </div>
      <div class="space-y-2">
        <Label for="browser-allowed">Allowed domains</Label>
        <Textarea
          id="browser-allowed"
          class="min-h-20 font-mono text-xs"
          :model-value="allowedDomainsText"
          placeholder="localhost&#10;*.example.com"
          @update:model-value="saveAllowedDomains"
        />
        <p class="text-sm text-muted-foreground">
          Empty allow list means all domains (deny list still applies). One host per line.
        </p>
      </div>
      <div class="space-y-2">
        <Label for="browser-denied">Denied domains</Label>
        <Textarea
          id="browser-denied"
          class="min-h-20 font-mono text-xs"
          :model-value="deniedDomainsText"
          placeholder="*.evil.com"
          @update:model-value="saveDeniedDomains"
        />
      </div>
    </div>
  </section>
</template>
