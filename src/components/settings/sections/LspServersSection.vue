<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { listen } from '@tauri-apps/api/event'
import {
  Ban,
  CircleCheck,
  Download,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/shadcn/ui/button'
import { Label } from '@/components/shadcn/ui/label'
import { Switch } from '@/components/shadcn/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/shadcn/ui/tooltip'
import SettingsSectionScroll from '@/components/settings/SettingsSectionScroll.vue'
import WorkbenchFileEntryIcon from '@/components/workbench/FileEntryIcon.vue'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import type { SettingsTab } from '@/composables/use-pyrola-config'
import {
  isTauri,
  lspCatalog,
  lspInstallServer,
  lspPrefetchDefaults,
  lspSetServerDisabled,
  lspUninstallServer,
  type LspCatalogEntry,
} from '@/services/pyrola/pyrola-tauri'
import useFleetRegistry from '@/composables/use-fleet-registry'
import lspServerIconName from '@/utils/lsp-server-icon-name'

const props = defineProps<{
  tab: SettingsTab
}>()

const config = usePyrolaConfig()
const fleet = useFleetRegistry()
const catalog = ref<LspCatalogEntry[]>([])
const installMessage = ref<string | null>(null)
const busyIds = ref<Set<string>>(new Set())
const prefetching = ref(false)
let unlistenInstall: (() => void) | null = null

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

const setBusy = (serverId: string, busy: boolean): void => {
  const next = new Set(busyIds.value)
  if (busy) {
    next.add(serverId)
  } else {
    next.delete(serverId)
  }
  busyIds.value = next
}

const isBusy = (serverId: string): boolean => busyIds.value.has(serverId)

const refreshCatalog = async (): Promise<void> => {
  if (!isTauri()) {
    return
  }
  try {
    catalog.value = await lspCatalog()
  } catch (error) {
    toast.error('Failed to load language servers', {
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

const statusHint = (entry: LspCatalogEntry): string => {
  const parts: string[] = []
  if (entry.extensions.length > 0) {
    parts.push(entry.extensions.slice(0, 6).join(', '))
  }
  parts.push(entry.running ? 'running' : 'idle')
  if (entry.source && entry.source !== 'none') {
    parts.push(entry.source)
  } else if (entry.installable) {
    parts.push('not installed')
  } else if (entry.installKind === 'toolchain') {
    parts.push('needs toolchain on PATH')
  }
  if (entry.requiresTrust && !workspaceTrusted.value) {
    parts.push('requires workspace trust')
  }
  if (entry.disabled) {
    parts.push('disabled')
  }
  if (entry.installState && entry.installState !== 'ready' && entry.installState !== 'missing') {
    parts.push(entry.installState)
  }
  return parts.join(', ')
}

const installServer = async (serverId: string): Promise<void> => {
  setBusy(serverId, true)
  try {
    await lspInstallServer(serverId)
    await refreshCatalog()
    toast.success(`Installed ${serverId}`)
  } catch (error) {
    toast.error(`Failed to install ${serverId}`, {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    setBusy(serverId, false)
  }
}

const uninstallServer = async (serverId: string): Promise<void> => {
  setBusy(serverId, true)
  try {
    await lspUninstallServer(serverId)
    await refreshCatalog()
    toast.success(`Uninstalled ${serverId}`)
  } catch (error) {
    toast.error(`Failed to uninstall ${serverId}`, {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    setBusy(serverId, false)
  }
}

const setDisabled = async (serverId: string, disabled: boolean): Promise<void> => {
  setBusy(serverId, true)
  try {
    const rootPath = props.tab === 'project' ? activeRoot.value : null
    if (props.tab === 'project' && !rootPath) {
      toast.error('Open a project to change project language servers')
      return
    }
    await lspSetServerDisabled(props.tab, serverId, disabled, rootPath)
    await refreshCatalog()
    toast.success(disabled ? `Disabled ${serverId}` : `Enabled ${serverId}`)
  } catch (error) {
    toast.error(`Failed to update ${serverId}`, {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    setBusy(serverId, false)
  }
}

const prefetchDefaults = async (): Promise<void> => {
  prefetching.value = true
  try {
    await lspPrefetchDefaults()
    toast.success('Installing default language support')
  } catch (error) {
    toast.error('Failed to start language support install', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    prefetching.value = false
  }
}

onMounted(async () => {
  await refreshCatalog()
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
        refreshCatalog().then(() => undefined).catch((error: unknown) => {
          toast.error('Failed to refresh language servers', {
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
    <template #actions>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8"
            aria-label="Install defaults"
            :disabled="!isTauri() || prefetching"
            @click="prefetchDefaults"
          >
            <Loader2
              v-if="prefetching"
              class="h-4 w-4 animate-spin"
            />
            <Download
              v-else
              class="h-4 w-4"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Install defaults</TooltipContent>
      </Tooltip>
    </template>

    <div class="space-y-6">
      <div class="flex items-center justify-between gap-4">
        <div class="space-y-1">
          <Label>Auto-download language servers</Label>
          <p class="text-sm text-muted-foreground">
            Download default language support on project open. Disable for airgapped machines.
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
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8"
                :aria-label="workspaceTrusted ? 'Workspace trusted' : 'Trust project'"
                :disabled="!activeRoot || workspaceTrusted"
                @click="trustWorkspace"
              >
                <ShieldCheck class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {{ workspaceTrusted ? 'Workspace trusted' : 'Trust project' }}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <p
        v-if="installMessage"
        class="text-sm text-muted-foreground"
      >
        {{ installMessage }}
      </p>
      <p
        v-else
        class="text-sm text-muted-foreground"
      >
        Language servers are always available. Install managed ones below, or disable a server for this scope.
      </p>

      <div class="space-y-2">
        <Label>Servers</Label>
        <ul class="divide-y divide-border/50 rounded-md border border-border/50">
          <li
            v-for="entry in catalog"
            :key="entry.id"
            class="flex items-center justify-between gap-3 px-3 py-2"
          >
            <div class="flex min-w-0 items-start gap-2">
              <WorkbenchFileEntryIcon
                :name="lspServerIconName(entry.id, entry.extensions)"
                class="mt-0.5"
              />
              <div class="min-w-0 space-y-0.5">
                <p class="truncate text-sm font-medium">{{ entry.label }}</p>
                <p class="truncate text-xs text-muted-foreground">
                  {{ statusHint(entry) }}
                </p>
                <p
                  v-if="entry.error"
                  class="truncate text-xs text-destructive"
                >
                  {{ entry.error }}
                </p>
              </div>
            </div>
            <div class="flex shrink-0 items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-8 w-8"
                    :aria-label="entry.disabled ? 'Enable' : 'Disable'"
                    :disabled="isBusy(entry.id)"
                    @click="setDisabled(entry.id, !entry.disabled)"
                  >
                    <CircleCheck
                      v-if="entry.disabled"
                      class="h-4 w-4"
                    />
                    <Ban
                      v-else
                      class="h-4 w-4"
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {{ entry.disabled ? 'Enable' : 'Disable' }}
                </TooltipContent>
              </Tooltip>

              <Tooltip v-if="entry.installable && !entry.installed">
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-8 w-8"
                    aria-label="Install"
                    :disabled="isBusy(entry.id) || entry.disabled"
                    @click="installServer(entry.id)"
                  >
                    <Loader2
                      v-if="isBusy(entry.id)"
                      class="h-4 w-4 animate-spin"
                    />
                    <Download
                      v-else
                      class="h-4 w-4"
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Install</TooltipContent>
              </Tooltip>

              <Tooltip v-else-if="entry.installable && entry.error">
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-8 w-8"
                    aria-label="Retry"
                    :disabled="isBusy(entry.id) || entry.disabled"
                    @click="installServer(entry.id)"
                  >
                    <Loader2
                      v-if="isBusy(entry.id)"
                      class="h-4 w-4 animate-spin"
                    />
                    <RotateCcw
                      v-else
                      class="h-4 w-4"
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Retry</TooltipContent>
              </Tooltip>

              <Tooltip v-if="entry.installable && entry.installed && entry.source === 'managed'">
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-8 w-8"
                    aria-label="Uninstall"
                    :disabled="isBusy(entry.id)"
                    @click="uninstallServer(entry.id)"
                  >
                    <Loader2
                      v-if="isBusy(entry.id)"
                      class="h-4 w-4 animate-spin"
                    />
                    <Trash2
                      v-else
                      class="h-4 w-4"
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Uninstall</TooltipContent>
              </Tooltip>
            </div>
          </li>
        </ul>
        <p
          v-if="!isTauri()"
          class="text-sm text-muted-foreground"
        >
          Language servers require the desktop app.
        </p>
      </div>
    </div>
  </SettingsSectionScroll>
</template>
