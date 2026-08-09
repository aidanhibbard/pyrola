<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { KeyRound, Loader2, Pencil, Plus, RefreshCw, Settings2, Trash2 } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/shadcn/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/shadcn/ui/tooltip'
import { Input } from '@/components/shadcn/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/ui/dialog'
import SettingsSectionScroll from '@/components/settings/SettingsSectionScroll.vue'
import SettingsInputPasswordInput from '@/components/settings/input/PasswordInput.vue'
import SettingsProvidersManageProviderDialog from '@/components/settings/providers/ManageProviderDialog.vue'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import type { SettingsTab } from '@/composables/use-pyrola-config'
import type { PyrolaCustomProvider } from '@/types/pyrola/pyrola-settings'
import listConfiguredProviders from '@/services/providers/list-configured-providers'
import {
  getCustomProvider,
  getProviderCatalogEntry,
  keychainKeyForProvider,
  AI_SDK_PROVIDER_CATALOG,
  OPENAI_COMPATIBLE_PROVIDER_CATALOG,
  providerKeyRef,
  providerRequiresApiKey,
} from '@/services/providers/registry'
import { deleteSecret, getSecret, setSecret } from '@/services/pyrola/pyrola-tauri'
import { testProviderConnection } from '@/services/providers/test-connection'

const props = defineProps<{
  tab: SettingsTab
}>()

const config = usePyrolaConfig()
const testingProviderId = ref<string | null>(null)
const apiKeyConfigured = ref<Record<string, boolean>>({})
const addDialogOpen = ref(false)
const manageDialogOpen = ref(false)
const manageMode = ref<'create' | 'edit'>('create')
const manageProviderId = ref<string | null>(null)
const editApiKeyProviderId = ref<string | null>(null)
const apiKeyInput = ref('')
const providerSearchQuery = ref('')

let apiKeyStatusGeneration = 0

const dialogSurfaceClass =
  'border-border/80 bg-zinc-50 shadow-2xl backdrop-blur-none dark:bg-zinc-900'

const settings = computed(() => config.getScopeSettings(props.tab))

const configuredProviders = computed(() => listConfiguredProviders(settings.value))

const hasProviders = computed(() => configuredProviders.value.length > 0)

const normalizedProviderSearch = computed(() => providerSearchQuery.value.trim().toLowerCase())

const filteredAiSdkProviders = computed(() => {
  const query = normalizedProviderSearch.value
  if (!query) {
    return AI_SDK_PROVIDER_CATALOG
  }
  return AI_SDK_PROVIDER_CATALOG.filter(
    (entry) =>
      entry.name.toLowerCase().includes(query) || entry.id.toLowerCase().includes(query),
  )
})

const filteredOpenAiCompatibleProviders = computed(() => {
  const query = normalizedProviderSearch.value
  if (!query) {
    return OPENAI_COMPATIBLE_PROVIDER_CATALOG
  }
  return OPENAI_COMPATIBLE_PROVIDER_CATALOG.filter(
    (entry) =>
      entry.name.toLowerCase().includes(query) || entry.id.toLowerCase().includes(query),
  )
})

const hasProviderSearchResults = computed(
  () =>
    filteredAiSdkProviders.value.length > 0 ||
    filteredOpenAiCompatibleProviders.value.length > 0,
)

const manageInitialProvider = computed((): PyrolaCustomProvider | null => {
  if (!manageProviderId.value) {
    return null
  }
  return getCustomProvider(settings.value, manageProviderId.value) ?? null
})

const getApiKeyRef = (providerId: string): string | undefined => {
  const custom = getCustomProvider(settings.value, providerId)
  if (custom?.apiKeyRef) {
    return custom.apiKeyRef
  }
  const key = `providers.${providerId}.apiKeyRef` as const
  return settings.value[key]
}

const getProviderDisplayName = (providerId: string): string => {
  const custom = getCustomProvider(settings.value, providerId)
  if (custom?.name) {
    return custom.name
  }
  return getProviderCatalogEntry(providerId)?.name ?? providerId
}

const isCustomProvider = (providerId: string): boolean =>
  Boolean(getCustomProvider(settings.value, providerId))

const hasApiKeyInKeychain = (providerId: string): boolean =>
  apiKeyConfigured.value[providerId] === true

const refreshApiKeyStatus = async (): Promise<void> => {
  const generation = ++apiKeyStatusGeneration
  const next: Record<string, boolean> = {}

  for (const providerId of configuredProviders.value) {
    const ref = getApiKeyRef(providerId)
    if (!ref) {
      next[providerId] = false
      continue
    }

    try {
      const secret = await getSecret(keychainKeyForProvider(ref))
      if (generation !== apiKeyStatusGeneration) {
        return
      }
      next[providerId] = Boolean(secret)
    } catch {
      next[providerId] = false
    }
  }

  if (generation !== apiKeyStatusGeneration) {
    return
  }

  apiKeyConfigured.value = next
}

const setApiKeyConfigured = (providerId: string, configured: boolean): void => {
  apiKeyConfigured.value = {
    ...apiKeyConfigured.value,
    [providerId]: configured,
  }
}

const getCustomModelCount = (providerId: string): number =>
  getCustomProvider(settings.value, providerId)?.models?.length ?? 0

const openApiKeyDialog = (providerId: string): void => {
  apiKeyInput.value = ''
  editApiKeyProviderId.value = providerId
}

const openAddDialog = (): void => {
  providerSearchQuery.value = ''
  addDialogOpen.value = true
}

const openCreateCustomDialog = (): void => {
  addDialogOpen.value = false
  manageMode.value = 'create'
  manageProviderId.value = null
  manageDialogOpen.value = true
}

const openManageCustomDialog = (providerId: string): void => {
  manageMode.value = 'edit'
  manageProviderId.value = providerId
  manageDialogOpen.value = true
}

const openEditDialog = (providerId: string): void => {
  if (isCustomProvider(providerId)) {
    openManageCustomDialog(providerId)
    return
  }
  openApiKeyDialog(providerId)
}

const resolveManageStoredApiKey = async (): Promise<string> => {
  if (!manageProviderId.value) {
    return ''
  }
  const ref = getApiKeyRef(manageProviderId.value)
  if (!ref) {
    return ''
  }
  return (await getSecret(keychainKeyForProvider(ref))) ?? ''
}

const handleAddDialogOpenChange = (open: boolean): void => {
  addDialogOpen.value = open
  if (!open) {
    providerSearchQuery.value = ''
  }
}

const addProvider = async (providerId: string): Promise<void> => {
  const ref = providerKeyRef(providerId)
  await config.updateSetting(
    props.tab,
    `providers.${providerId}.apiKeyRef` as keyof typeof settings.value,
    ref,
  )
  addDialogOpen.value = false
  if (providerRequiresApiKey(providerId, settings.value)) {
    openApiKeyDialog(providerId)
  }
}

const handleManageSave = async (payload: {
  providerId: string
  provider: PyrolaCustomProvider
  apiKey: string | null
  clearApiKey: boolean
}): Promise<void> => {
  const wasCreate = manageMode.value === 'create'
  try {
    await config.updateSetting(
      props.tab,
      `providers.custom.${payload.providerId}` as keyof typeof settings.value,
      payload.provider,
    )

    const keyRef = payload.provider.apiKeyRef ?? payload.providerId
    if (payload.clearApiKey) {
      await deleteSecret(keychainKeyForProvider(keyRef))
      setApiKeyConfigured(payload.providerId, false)
    } else if (payload.apiKey) {
      await setSecret(keychainKeyForProvider(keyRef), payload.apiKey)
      setApiKeyConfigured(payload.providerId, true)
    }

    await refreshApiKeyStatus()

    if (wasCreate) {
      manageMode.value = 'edit'
      manageProviderId.value = payload.providerId
      manageDialogOpen.value = true
      toast.success('Provider added', {
        description: 'Add or edit models below, then save again when you are done.',
      })
      return
    }

    // Keep the manage dialog open after edit so models can be iterated on.
    manageProviderId.value = payload.providerId
    manageMode.value = 'edit'
    manageDialogOpen.value = true
    toast.success('Provider saved')
  } catch (error) {
    toast.error('Failed to save provider', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const saveApiKey = async (providerId: string): Promise<void> => {
  if (!apiKeyInput.value.trim()) {
    toast.error('API key is required')
    return
  }

  try {
    const ref = getApiKeyRef(providerId) ?? providerKeyRef(providerId)
    await setSecret(keychainKeyForProvider(ref), apiKeyInput.value.trim())
    setApiKeyConfigured(providerId, true)
    apiKeyInput.value = ''
    editApiKeyProviderId.value = null
    await refreshApiKeyStatus()
    toast.success('API key saved')
  } catch (error) {
    toast.error('Failed to save API key', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const clearApiKey = async (providerId: string): Promise<void> => {
  const ref = getApiKeyRef(providerId)
  if (!ref) {
    return
  }

  try {
    await deleteSecret(keychainKeyForProvider(ref))
    setApiKeyConfigured(providerId, false)
    await refreshApiKeyStatus()
    toast.success('API key cleared')
  } catch (error) {
    toast.error('Failed to clear API key', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const removeProvider = async (providerId: string): Promise<void> => {
  try {
    const ref = getApiKeyRef(providerId)
    if (ref) {
      await deleteSecret(keychainKeyForProvider(ref))
    }

    const isCustom = isCustomProvider(providerId)
    const keysToRemove = isCustom
      ? [`providers.custom.${providerId}`]
      : [`providers.${providerId}.apiKeyRef`]

    await config.removeSettings(props.tab, keysToRemove)
    toast.success('Provider removed')
  } catch (error) {
    toast.error('Failed to remove provider', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const testConnection = async (providerId: string): Promise<void> => {
  testingProviderId.value = providerId
  try {
    const custom = getCustomProvider(settings.value, providerId)
    const requiresKey = providerRequiresApiKey(providerId, settings.value)
    const ref = getApiKeyRef(providerId)
    let apiKey = ''

    if (ref) {
      apiKey = (await getSecret(keychainKeyForProvider(ref))) ?? ''
    }

    if (requiresKey && !apiKey) {
      throw new Error(ref ? 'No API key in keychain' : 'No API key configured')
    }

    await testProviderConnection({
      providerId: custom ? 'openai' : providerId,
      apiKey,
      baseUrl: custom?.baseURL ?? getProviderCatalogEntry(providerId)?.defaultBaseUrl,
    })
    toast.success('Connection successful')
  } catch (error) {
    toast.error('Connection failed', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    testingProviderId.value = null
  }
}

watch(
  [configuredProviders, () => props.tab],
  async () => {
    try {
      await refreshApiKeyStatus()
    } catch (error) {
      toast.error('Failed to refresh API key status', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  },
  { immediate: true },
)
</script>

<template>
  <SettingsSectionScroll title="Providers">
    <template #actions>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8"
            aria-label="Add provider"
            @click="openAddDialog"
          >
            <Plus class="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Add provider</TooltipContent>
      </Tooltip>
    </template>

    <div
      v-if="!hasProviders"
      class="flex items-center justify-center rounded-lg border border-dashed border-border/60 px-4 py-12"
    >
      <p class="text-sm text-muted-foreground">No providers configured yet.</p>
    </div>

    <template v-else>
      <div class="space-y-2">
        <div
          v-for="providerId in configuredProviders"
          :key="providerId"
          class="flex flex-col gap-3 rounded-lg border border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p class="font-medium">
              {{ getProviderDisplayName(providerId) }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{
                hasApiKeyInKeychain(providerId)
                  ? 'API key configured'
                  : providerRequiresApiKey(providerId, settings)
                    ? 'No API key'
                    : 'API key optional'
              }}<template v-if="isCustomProvider(providerId)">, {{
                  getCustomModelCount(providerId) > 0
                    ? `${getCustomModelCount(providerId)} model${getCustomModelCount(providerId) === 1 ? '' : 's'}`
                    : 'No models configured'
                }}</template>
            </p>
          </div>
          <div class="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8"
                  :aria-label="
                    isCustomProvider(providerId)
                      ? 'Manage provider and models'
                      : hasApiKeyInKeychain(providerId)
                        ? 'Edit key'
                        : 'Add key'
                  "
                  @click="openEditDialog(providerId)"
                >
                  <Settings2 v-if="isCustomProvider(providerId)" class="h-4 w-4" />
                  <Pencil v-else class="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {{
                  isCustomProvider(providerId)
                    ? 'Manage provider & models'
                    : hasApiKeyInKeychain(providerId)
                      ? 'Edit key'
                      : 'Add key'
                }}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8"
                  aria-label="Test connection"
                  :disabled="testingProviderId === providerId"
                  @click="testConnection(providerId)"
                >
                  <Loader2
                    v-if="testingProviderId === providerId"
                    class="h-4 w-4 animate-spin"
                  />
                  <RefreshCw v-else class="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Test connection</TooltipContent>
            </Tooltip>
            <Tooltip v-if="hasApiKeyInKeychain(providerId)">
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8"
                  aria-label="Clear key"
                  @click="clearApiKey(providerId)"
                >
                  <KeyRound class="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear key</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8 text-destructive hover:text-destructive"
                  aria-label="Remove provider"
                  @click="removeProvider(providerId)"
                >
                  <Trash2 class="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Remove</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </template>

    <Dialog :open="addDialogOpen" @update:open="handleAddDialogOpenChange">
      <DialogContent :class="dialogSurfaceClass">
        <DialogHeader>
          <DialogTitle>Add provider</DialogTitle>
        </DialogHeader>
        <Input v-model="providerSearchQuery" placeholder="Search providers…" />
        <div class="max-h-[min(24rem,60vh)] overflow-y-auto">
          <Button
            variant="ghost"
            class="h-auto w-full justify-start px-3 py-2.5 font-normal"
            @click="openCreateCustomDialog"
          >
            Custom OpenAI-compatible
          </Button>
          <template v-if="filteredAiSdkProviders.length > 0">
            <p class="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">AI SDK providers</p>
            <div class="flex flex-col gap-0.5">
              <Button
                v-for="entry in filteredAiSdkProviders"
                :key="entry.id"
                variant="ghost"
                class="h-auto w-full justify-start px-3 py-2.5 font-normal"
                @click="addProvider(entry.id)"
              >
                {{ entry.name }}
              </Button>
            </div>
          </template>
          <template v-if="filteredOpenAiCompatibleProviders.length > 0">
            <p class="px-3 pb-1 pt-3 text-xs font-medium text-muted-foreground">
              OpenAI-compatible
            </p>
            <div class="flex flex-col gap-0.5">
              <Button
                v-for="entry in filteredOpenAiCompatibleProviders"
                :key="entry.id"
                variant="ghost"
                class="h-auto w-full justify-start px-3 py-2.5 font-normal"
                @click="addProvider(entry.id)"
              >
                {{ entry.name }}
              </Button>
            </div>
          </template>
          <p
            v-if="providerSearchQuery.trim() && !hasProviderSearchResults"
            class="px-3 py-6 text-center text-sm text-muted-foreground"
          >
            No providers match your search.
          </p>
        </div>
      </DialogContent>
    </Dialog>

    <SettingsProvidersManageProviderDialog
      v-model:open="manageDialogOpen"
      :mode="manageMode"
      :provider-id="manageProviderId"
      :initial-provider="manageInitialProvider"
      :initial-api-key-configured="
        manageProviderId ? hasApiKeyInKeychain(manageProviderId) : false
      "
      :resolve-stored-api-key="resolveManageStoredApiKey"
      @save="handleManageSave"
    />

    <Dialog
      :open="!!editApiKeyProviderId"
      @update:open="(open) => !open && (editApiKeyProviderId = null)"
    >
      <DialogContent :class="dialogSurfaceClass">
        <DialogHeader>
          <DialogTitle>
            {{
              editApiKeyProviderId && hasApiKeyInKeychain(editApiKeyProviderId)
                ? 'Edit API key'
                : 'Add API key'
            }}
          </DialogTitle>
        </DialogHeader>
        <SettingsInputPasswordInput v-model="apiKeyInput" placeholder="sk-..." />
        <DialogFooter>
          <Button @click="editApiKeyProviderId && saveApiKey(editApiKeyProviderId)">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </SettingsSectionScroll>
</template>
