import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import type { PyrolaChatMode } from '@/types/pyrola/pyrola-settings'
import { HOME_CHAT_SLUG } from '@/constants/home-chat'
import { getFrozenPrefix } from '@/services/harness/prefix-contract'
import { normalizeStoredModelRef } from '@/schemas/pyrola-settings'
import useChatStore from '@/composables/use-chat-store'
import useContextUsage from '@/composables/use-context-usage'
import useFleetRegistry from '@/composables/use-fleet-registry'
import usePyrolaConfig from '@/composables/use-pyrola-config'

const draftModelRef = ref('')
const draftMode = ref<PyrolaChatMode>('agent')

let watchStarted = false

export default () => {
  const chatStore = useChatStore()
  const contextUsage = useContextUsage()
  const fleet = useFleetRegistry()
  const config = usePyrolaConfig()

  const setDraftSelection = (model: string, mode: PyrolaChatMode): void => {
    if (model) {
      draftModelRef.value = model
    }
    draftMode.value = mode
  }

  const refreshContextBudget = async (): Promise<void> => {
    const meta = chatStore.meta.value
    const modelId =
      draftModelRef.value ||
      (meta?.model ? normalizeStoredModelRef(meta.model) ?? meta.model : '') ||
      ''
    if (!modelId) {
      return
    }

    const mode = draftMode.value || meta?.mode || 'agent'
    const project = fleet.activeProject.value
    const standalone = meta?.projectSlug === HOME_CHAT_SLUG
    const projectRoot = standalone
      ? meta?.projectRoot
      : project?.rootPath ?? meta?.projectRoot
    if (!projectRoot) {
      return
    }

    const projectName = standalone
      ? 'Home'
      : project?.name ?? meta?.projectSlug ?? 'Home'

    const frozenSnapshot = meta ? getFrozenPrefix(meta) : null

    await contextUsage.refresh({
      modelId,
      mode,
      projectName,
      projectRoot,
      messages: chatStore.messages.value,
      settings: config.effectiveSettings.value,
      standalone,
      frozenSnapshot,
    })
  }

  if (!watchStarted) {
    watchStarted = true
    watch(
      [
        draftModelRef,
        draftMode,
        () => chatStore.messages.value.length,
        () => fleet.activeProject.value?.id,
        () => chatStore.meta.value?.model,
        () => chatStore.meta.value?.mode,
        () => chatStore.meta.value?.prefixSnapshot?.hash,
        () => chatStore.meta.value?.id,
      ],
      () => {
        const timer = window.setTimeout(() => {
          refreshContextBudget().catch((error) => {
            toast.error('Failed to refresh context usage', {
              description: error instanceof Error ? error.message : 'Unknown error',
            })
          })
        }, 0)
        return () => window.clearTimeout(timer)
      },
      { immediate: true },
    )
  }

  return {
    draftModelRef,
    draftMode,
    setDraftSelection,
    refreshContextBudget,
  }
}
