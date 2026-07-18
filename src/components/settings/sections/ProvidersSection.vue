<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/shadcn/ui/button'
import { Input } from '@/components/shadcn/ui/input'
import { Label } from '@/components/shadcn/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/ui/dialog'
import SettingsSectionScroll from '@/components/settings/SettingsSectionScroll.vue'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import type { SettingsTab } from '@/composables/use-pyrola-config'
import type { PyrolaCustomProvider } from '@/types/pyrola/pyrola-settings'
import listConfiguredProviders from '@/services/providers/list-configured-providers'
import {
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
const customDialogOpen = ref(false)
const editProviderId = ref<string | null>(null)
const apiKeyInput = ref('')
const customName = ref('')
const customBaseUrl = ref('http://localhost:1234/v1')
const customApiKeyInput = ref('')
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

const getApiKeyRef = (providerId: string): string | undefined => {
  const customKey = `providers.custom.${providerId}` as const
  const custom = settings.value[customKey] as PyrolaCustomProvider | undefined
  if (custom?.apiKeyRef) {
    return custom.apiKeyRef
  }
  const key = `providers.${providerId}.apiKeyRef` as const
  return settings.value[key]
}

const getProviderDisplayName = (providerId: string): string => {
  const customKey = `providers.custom.${providerId}` as const
  const custom = settings.value[customKey] as PyrolaCustomProvider | undefined
  if (custom?.name) {
    return custom.name
  }
  return getProviderCatalogEntry(providerId)?.name ?? providerId
}

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

const openApiKeyDialog = (providerId: string): void => {
  apiKeyInput.value = ''
  editProviderId.value = providerId
}

const openAddDialog = (): void => {
  customName.value = ''
  customBaseUrl.value = 'http://localhost:1234/v1'
  customApiKeyInput.value = ''
  providerSearchQuery.value = ''
  addDialogOpen.value = true
}

const openCustomDialog = (): void => {
  addDialogOpen.value = false
  customName.value = ''
  customBaseUrl.value = 'http://localhost:1234/v1'
  customApiKeyInput.value = ''
  customDialogOpen.value = true
}

const handleAddDialogOpenChange = (open: boolean): void => {
  addDialogOpen.value = open
  if (!open) {
    providerSearchQuery.value = ''
  }
}

const handleCustomDialogOpenChange = (open: boolean): void => {
  customDialogOpen.value = open
  if (!open) {
    customName.value = ''
    customBaseUrl.value = 'http://localhost:1234/v1'
    customApiKeyInput.value = ''
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
  if (providerRequiresApiKey(providerId)) {
    openApiKeyDialog(providerId)
  }
}

const saveCustomProvider = async (): Promise<void> => {
  if (!customName.value.trim()) {
    toast.error('Provider name is required')
    return
  }
  if (!customBaseUrl.value.trim()) {
    toast.error('Base URL is required')
    return
  }

  try {
    const id = customName.value.toLowerCase().replace(/\s+/g, '-')
    const provider: PyrolaCustomProvider = {
      type: 'openai-compatible',
      baseURL: customBaseUrl.value.trim(),
      apiKeyRef: id,
      name: customName.value.trim(),
    }
    await config.updateSetting(
      props.tab,
      `providers.custom.${id}` as keyof typeof settings.value,
      provider,
    )

    if (customApiKeyInput.value.trim()) {
      await setSecret(keychainKeyForProvider(id), customApiKeyInput.value.trim())
      setApiKeyConfigured(id, true)
    }

    customDialogOpen.value = false
    customName.value = ''
    customBaseUrl.value = 'http://localhost:1234/v1'
    customApiKeyInput.value = ''
    await refreshApiKeyStatus()
    toast.success('Provider added')
  } catch (error) {
    toast.error('Failed to add provider', {
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
    editProviderId.value = null
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

    const customKey = `providers.custom.${providerId}` as const
    const isCustom = Boolean(settings.value[customKey])
    const keysToRemove = isCustom
      ? [customKey]
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
    const ref = getApiKeyRef(providerId)
    const requiresKey = providerRequiresApiKey(providerId)
    let apiKey = ''

    if (requiresKey) {
      if (!ref) {
        throw new Error('No API key configured')
      }
      const secret = await getSecret(keychainKeyForProvider(ref))
      if (!secret) {
        throw new Error('No API key in keychain')
      }
      apiKey = secret
    }

    const customKey = `providers.custom.${providerId}` as const
    const custom = settings.value[customKey] as PyrolaCustomProvider | undefined

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
      <Button v-if="!hasProviders" variant="outline" size="sm" @click="openAddDialog">
        + Add provider
      </Button>
    </template>

    <div
      v-if="!hasProviders"
      class="flex items-center justify-center rounded-lg border border-dashed border-border/60 px-4 py-12"
    >
      <p class="text-sm text-muted-foreground">No providers configured yet.</p>
    </div>

    <template v-else>
      <div class="space-y-3">
        <div class="flex items-center justify-between gap-4">
          <h3 class="text-sm font-medium">Configured providers</h3>
          <Button variant="outline" size="sm" @click="openAddDialog">+ Add provider</Button>
        </div>

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
                    : providerRequiresApiKey(providerId)
                      ? 'No API key'
                      : 'API key optional'
                }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" @click="openApiKeyDialog(providerId)">
                {{ hasApiKeyInKeychain(providerId) ? 'Edit key' : 'Add key' }}
              </Button>
              <Button
                variant="outline"
                size="sm"
                :disabled="testingProviderId === providerId"
                @click="testConnection(providerId)"
              >
                Test connection
              </Button>
              <Button
                v-if="hasApiKeyInKeychain(providerId)"
                variant="ghost"
                size="sm"
                @click="clearApiKey(providerId)"
              >
                Clear key
              </Button>
              <Button variant="ghost" size="sm" class="text-destructive" @click="removeProvider(providerId)">
                Remove
              </Button>
            </div>
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
            @click="openCustomDialog"
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

    <Dialog :open="customDialogOpen" @update:open="handleCustomDialogOpenChange">
      <DialogContent :class="dialogSurfaceClass">
        <DialogHeader>
          <DialogTitle>Custom OpenAI-compatible provider</DialogTitle>
        </DialogHeader>
        <p class="text-sm text-muted-foreground">
          Connect a private or self-hosted endpoint that speaks the OpenAI API, such as LM Studio,
          vLLM, or an internal gateway.
        </p>
        <div class="space-y-4">
          <div class="space-y-2">
            <Label for="custom-provider-name">Name</Label>
            <Input
              id="custom-provider-name"
              v-model="customName"
              placeholder="LM Studio"
            />
          </div>
          <div class="space-y-2">
            <Label for="custom-provider-base-url">Base URL</Label>
            <Input
              id="custom-provider-base-url"
              v-model="customBaseUrl"
              placeholder="http://localhost:1234/v1"
            />
          </div>
          <div class="space-y-2">
            <Label for="custom-provider-api-key">API key (optional)</Label>
            <Input
              id="custom-provider-api-key"
              v-model="customApiKeyInput"
              type="password"
              placeholder="sk-..."
            />
            <p class="text-xs text-muted-foreground">
              Leave blank for local servers that do not require authentication.
            </p>
          </div>
        </div>
        <DialogFooter class="gap-2 sm:justify-end">
          <Button variant="outline" @click="customDialogOpen = false">Cancel</Button>
          <Button @click="saveCustomProvider">Add provider</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog :open="!!editProviderId" @update:open="(open) => !open && (editProviderId = null)">
      <DialogContent :class="dialogSurfaceClass">
        <DialogHeader>
          <DialogTitle>
            {{ editProviderId && hasApiKeyInKeychain(editProviderId) ? 'Edit API key' : 'Add API key' }}
          </DialogTitle>
        </DialogHeader>
        <Input v-model="apiKeyInput" type="password" placeholder="sk-..." />
        <DialogFooter>
          <Button @click="editProviderId && saveApiKey(editProviderId)">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </SettingsSectionScroll>
</template>
