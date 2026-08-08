<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, type Component } from 'vue'
import { listen } from '@tauri-apps/api/event'
import {
  Activity,
  AlertCircle,
  Ban,
  Download,
  HardDrive,
  Loader2,
  Package,
  PackageX,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Wrench,
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
import formatUnknownError from '@/utils/format-unknown-error'
import lspServerIconName from '@/utils/lsp-server-icon-name'

type LspStatusBadge = {
  key: string
  label: string
  icon: Component
  className: string
}

const config = usePyrolaConfig()
const fleet = useFleetRegistry()
const catalog = ref<LspCatalogEntry[]>([])
const installMessage = ref<string | null>(null)
const busyIds = ref<Set<string>>(new Set())
const prefetching = ref(false)
let unlistenInstall: (() => void) | null = null

const autoDownload = computed(
  () => config.personalSettings.value['lsp.autoDownload'] ?? true,
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
      description: formatUnknownError(error),
    })
  }
}

const updateAutoDownload = async (value: boolean): Promise<void> => {
  try {
    await config.updateSetting('personal', 'lsp.autoDownload', value)
  } catch (error) {
    toast.error('Failed to save auto-download setting', {
      description: formatUnknownError(error),
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
      description: formatUnknownError(error),
    })
  }
}

const extensionsHint = (entry: LspCatalogEntry): string =>
  entry.extensions.slice(0, 6).join(', ')

const statusBadges = (entry: LspCatalogEntry): LspStatusBadge[] => {
  const badges: LspStatusBadge[] = []

  if (entry.disabled) {
    badges.push({
      key: 'disabled',
      label: 'Disabled',
      icon: Ban,
      className: 'text-muted-foreground',
    })
  }

  if (entry.requiresTrust && !workspaceTrusted.value) {
    badges.push({
      key: 'trust',
      label: 'Requires workspace trust',
      icon: ShieldAlert,
      className: 'text-amber-600 dark:text-amber-500',
    })
  }

  if (entry.running) {
    badges.push({
      key: 'running',
      label: 'Running',
      icon: Activity,
      className: 'text-emerald-600 dark:text-emerald-500',
    })
  }

  if (entry.source === 'managed') {
    badges.push({
      key: 'managed',
      label: 'Managed install',
      icon: Package,
      className: 'text-muted-foreground',
    })
  } else if (entry.source === 'path') {
    badges.push({
      key: 'path',
      label: 'Available on PATH',
      icon: HardDrive,
      className: 'text-muted-foreground',
    })
  } else if (entry.source === 'custom') {
    badges.push({
      key: 'custom',
      label: 'Custom configuration',
      icon: HardDrive,
      className: 'text-muted-foreground',
    })
  } else if (entry.installable && !entry.installed) {
    badges.push({
      key: 'missing',
      label: 'Not installed',
      icon: PackageX,
      className: 'text-muted-foreground',
    })
  } else if (entry.installKind === 'toolchain') {
    badges.push({
      key: 'toolchain',
      label: 'Needs toolchain on PATH',
      icon: Wrench,
      className: 'text-muted-foreground',
    })
  }

  if (entry.error) {
    badges.push({
      key: 'error',
      label: entry.error,
      icon: AlertCircle,
      className: 'text-destructive',
    })
  } else if (
    entry.installState
    && entry.installState !== 'ready'
    && entry.installState !== 'missing'
    && entry.installState !== 'toolchain'
    && entry.installState !== 'stopped'
  ) {
    badges.push({
      key: 'state',
      label: entry.installState,
      icon: Loader2,
      className: 'text-muted-foreground',
    })
  }

  return badges
}

const installServer = async (serverId: string): Promise<void> => {
  setBusy(serverId, true)
  try {
    await lspInstallServer(serverId)
    await refreshCatalog()
    toast.success(`Installed ${serverId}`)
  } catch (error) {
    toast.error(`Failed to install ${serverId}`, {
      description: formatUnknownError(error),
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
      description: formatUnknownError(error),
    })
  } finally {
    setBusy(serverId, false)
  }
}

const setDisabled = async (serverId: string, disabled: boolean): Promise<void> => {
  setBusy(serverId, true)
  try {
    await lspSetServerDisabled(serverId, disabled)
    await refreshCatalog()
    toast.success(disabled ? `Disabled ${serverId}` : `Enabled ${serverId}`)
  } catch (error) {
    toast.error(`Failed to update ${serverId}`, {
      description: formatUnknownError(error),
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
      description: formatUnknownError(error),
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
            description: formatUnknownError(error),
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
        Language servers are always available. Install managed ones below, or disable a server globally.
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
                <div class="flex min-w-0 items-center gap-1.5">
                  <p class="truncate text-sm font-medium">{{ entry.label }}</p>
                  <div class="flex shrink-0 items-center gap-1">
                    <Tooltip
                      v-for="badge in statusBadges(entry)"
                      :key="badge.key"
                    >
                      <TooltipTrigger as-child>
                        <span
                          class="inline-flex"
                          :aria-label="badge.label"
                        >
                          <component
                            :is="badge.icon"
                            class="h-3.5 w-3.5"
                            :class="[
                              badge.className,
                              badge.key === 'state' ? 'animate-spin' : '',
                            ]"
                          />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{{ badge.label }}</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <p
                  v-if="extensionsHint(entry)"
                  class="truncate text-xs text-muted-foreground"
                >
                  {{ extensionsHint(entry) }}
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
                    <Play
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
