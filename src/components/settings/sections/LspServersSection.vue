<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { toast } from 'vue-sonner'
import { Button } from '@/components/shadcn/ui/button'
import { Label } from '@/components/shadcn/ui/label'
import { Switch } from '@/components/shadcn/ui/switch'
import SettingsSectionScroll from '@/components/settings/SettingsSectionScroll.vue'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import type { SettingsTab } from '@/composables/use-pyrola-config'
import {
  isTauri,
  lspInstallServer,
  lspPrefetchDefaults,
  lspStatus,
  type LspServerStatus,
} from '@/services/pyrola/pyrola-tauri'
import useFleetRegistry from '@/composables/use-fleet-registry'

const props = defineProps<{
  tab: SettingsTab
}>()

const config = usePyrolaConfig()
const fleet = useFleetRegistry()
const statuses = ref<LspServerStatus[]>([])
const installMessage = ref<string | null>(null)
let unlistenInstall: (() => void) | null = null

const BUILTIN_SERVERS = [
  { id: 'typescript', tier: 'A', label: 'TypeScript / JavaScript' },
  { id: 'vue', tier: 'A', label: 'Vue' },
  { id: 'json', tier: 'A', label: 'JSON' },
  { id: 'yaml', tier: 'A', label: 'YAML' },
  { id: 'markdown', tier: 'A', label: 'Markdown' },
  { id: 'python', tier: 'B', label: 'Python (basedpyright)' },
  { id: 'rust', tier: 'B', label: 'Rust' },
  { id: 'gopls', tier: 'B', label: 'Go' },
  { id: 'bash', tier: 'B', label: 'Bash' },
  { id: 'html', tier: 'B', label: 'HTML' },
  { id: 'css', tier: 'B', label: 'CSS' },
  { id: 'svelte', tier: 'B', label: 'Svelte' },
  { id: 'astro', tier: 'B', label: 'Astro' },
] as const

const lspEnabled = computed(
  () => config.getScopeSettings(props.tab)['lsp.enabled'] ?? false,
)

const autoDownload = computed(
  () => config.getScopeSettings(props.tab)['lsp.autoDownload'] ?? true,
)

const activeRoot = computed(() => fleet.activeProject.value?.rootPath ?? null)

const workspaceTrusted = computed(() => {
  const root = activeRoot.value
  if (!root) {
    return false
  }
  const records = config.effectiveSettings.value['workspace.trust'] ?? []
  return records.some((record) => record.rootPath === root && record.trusted)
})

const refreshStatuses = async (): Promise<void> => {
  if (!isTauri()) {
    return
  }
  try {
    statuses.value = await lspStatus()
  } catch (error) {
    toast.error('Failed to load LSP status', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const statusFor = (id: string): LspServerStatus | undefined =>
  statuses.value.find((status) => status.id === id)

const updateLspEnabled = async (value: boolean): Promise<void> => {
  try {
    await config.updateSetting(props.tab, 'lsp.enabled', value)
  } catch (error) {
    toast.error('Failed to save LSP setting', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const updateAutoDownload = async (value: boolean): Promise<void> => {
  try {
    await config.updateSetting(props.tab, 'lsp.autoDownload', value)
  } catch (error) {
    toast.error('Failed to save auto-download setting', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const trustWorkspace = async (): Promise<void> => {
  const root = activeRoot.value
  if (!root) {
    toast.error('No active project to trust')
    return
  }
  const existing = config.effectiveSettings.value['workspace.trust'] ?? []
  const next = [
    ...existing.filter((record) => record.rootPath !== root),
    { rootPath: root, trusted: true },
  ]
  try {
    await config.updateSetting('personal', 'workspace.trust', next)
    toast.success('Workspace trusted for project-local language tools')
  } catch (error) {
    toast.error('Failed to save workspace trust', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const retryInstall = async (serverId: string): Promise<void> => {
  try {
    await lspInstallServer(serverId)
    await refreshStatuses()
    toast.success(`Installed ${serverId}`)
  } catch (error) {
    toast.error(`Failed to install ${serverId}`, {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const prefetchDefaults = async (): Promise<void> => {
  try {
    await lspPrefetchDefaults()
    toast.success('Installing default language support')
  } catch (error) {
    toast.error('Failed to start language support install', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

onMounted(async () => {
  await refreshStatuses()
  if (!isTauri()) {
    return
  }
  try {
    unlistenInstall = await listen<{
      serverId: string
      state: string
      message?: string | null
    }>('lsp://install', (event) => {
      installMessage.value = event.payload.message ?? `${event.payload.serverId}: ${event.payload.state}`
      if (event.payload.state === 'ready' || event.payload.state === 'error') {
        refreshStatuses().then(() => undefined).catch((error: unknown) => {
          toast.error('Failed to refresh LSP status', {
            description: error instanceof Error ? error.message : 'Unknown error',
          })
        })
      }
    })
  } catch {
    // Event listen unavailable outside Tauri
  }
})

onUnmounted(() => {
  unlistenInstall?.()
  unlistenInstall = null
})
</script>

<template>
  <SettingsSectionScroll title="LSP">
    <div class="space-y-6">
      <div class="flex items-center justify-between gap-4">
        <div class="space-y-1">
          <Label>Enable language servers</Label>
          <p class="text-sm text-muted-foreground">
            Language support installs automatically for Monaco and agent tools.
          </p>
        </div>
        <Switch :model-value="lspEnabled" @update:model-value="updateLspEnabled" />
      </div>

      <div class="flex items-center justify-between gap-4">
        <div class="space-y-1">
          <Label>Auto-download language servers</Label>
          <p class="text-sm text-muted-foreground">
            Download Tier A defaults on project open. Disable for airgapped machines.
          </p>
        </div>
        <Switch :model-value="autoDownload" @update:model-value="updateAutoDownload" />
      </div>

      <div class="space-y-2 rounded-md border border-border/50 p-3">
        <div class="flex items-center justify-between gap-3">
          <div class="space-y-1">
            <Label>Workspace trust</Label>
            <p class="text-sm text-muted-foreground">
              Required only for project-local binaries (node_modules) and ESLint/Biome/Oxlint.
              Managed servers work without trust.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            :disabled="!activeRoot || workspaceTrusted"
            @click="trustWorkspace"
          >
            {{ workspaceTrusted ? 'Trusted' : 'Trust project' }}
          </Button>
        </div>
      </div>

      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-muted-foreground">
          {{ installMessage ?? 'Built-in corpus: TypeScript, Vue, JSON, YAML, Markdown, plus lazy installs for Python, Rust, Go, and more.' }}
        </p>
        <Button size="sm" variant="secondary" @click="prefetchDefaults">
          Install defaults
        </Button>
      </div>

      <div class="space-y-2">
        <Label>Servers</Label>
        <ul class="divide-y divide-border/50 rounded-md border border-border/50">
          <li
            v-for="server in BUILTIN_SERVERS"
            :key="server.id"
            class="flex items-center justify-between gap-3 px-3 py-2"
          >
            <div class="min-w-0 space-y-0.5">
              <p class="truncate text-sm font-medium">{{ server.label }}</p>
              <p class="truncate text-xs text-muted-foreground">
                Tier {{ server.tier }}
                <template v-if="statusFor(server.id)">
                  ,
                  {{ statusFor(server.id)?.running ? 'running' : 'idle' }}
                  <template v-if="statusFor(server.id)?.source">
                    , {{ statusFor(server.id)?.source }}
                  </template>
                  <template v-if="statusFor(server.id)?.installState">
                    , {{ statusFor(server.id)?.installState }}
                  </template>
                </template>
              </p>
              <p
                v-if="statusFor(server.id)?.error"
                class="truncate text-xs text-destructive"
              >
                {{ statusFor(server.id)?.error }}
              </p>
            </div>
            <Button size="sm" variant="ghost" @click="retryInstall(server.id)">
              Retry
            </Button>
          </li>
        </ul>
      </div>
    </div>
  </SettingsSectionScroll>
</template>
