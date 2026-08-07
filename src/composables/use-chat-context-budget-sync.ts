import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import type { PyrolaChatMode } from '@/types/pyrola/pyrola-settings'
import type { ContextMention } from '@/types/harness/context-mention'
import { HOME_CHAT_SLUG } from '@/constants/home-chat'
import { getFrozenPrefix } from '@/services/harness/prefix-contract'
import { normalizeStoredModelRef } from '@/schemas/pyrola-settings'
import useChatStore from '@/composables/use-chat-store'
import useContextUsage from '@/composables/use-context-usage'
import useFleetRegistry from '@/composables/use-fleet-registry'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import useMcpServers from '@/composables/use-mcp-servers'

const draftModelRef = ref('')
const draftMode = ref<PyrolaChatMode>('agent')
const draftMentions = ref<ContextMention[]>([])

let watchStarted = false

const messagesContentKey = (messages: Array<{ parts: unknown[] }>): string =>
  messages
    .map((message) =>
      message.parts
        .map((part) => {
          if (
            part &&
            typeof part === 'object' &&
            'type' in part &&
            ((part as { type: string }).type === 'text' ||
              (part as { type: string }).type === 'reasoning') &&
            'text' in part
          ) {
            return String((part as { text: string }).text)
          }
          return JSON.stringify(part)
        })
        .join('\0'),
    )
    .join('\n')

const mcpStatusKey = (states: Record<string, { status: string; tools: unknown[] }>): string =>
  Object.keys(states)
    .sort()
    .map((id) => {
      const state = states[id]
      if (!state) {
        return `${id}:missing:0`
      }
      return `${id}:${state.status}:${state.tools.length}`
    })
    .join('|')

export default () => {
  const chatStore = useChatStore()
  const contextUsage = useContextUsage()
  const fleet = useFleetRegistry()
  const config = usePyrolaConfig()
  const mcp = useMcpServers()

  const setDraftSelection = (model: string, mode: PyrolaChatMode): void => {
    if (model) {
      draftModelRef.value = model
    }
    draftMode.value = mode
  }

  const setDraftMentions = (mentions: ContextMention[]): void => {
    draftMentions.value = mentions
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
      mentions: draftMentions.value,
      activeContext: meta?.activeContext ?? null,
      chatId: meta?.id,
    })
  }

  if (!watchStarted) {
    watchStarted = true
    watch(
      [
        draftModelRef,
        draftMode,
        draftMentions,
        () => chatStore.messages.value.length,
        () => messagesContentKey(chatStore.messages.value),
        () => fleet.activeProject.value?.id,
        () => chatStore.meta.value?.model,
        () => chatStore.meta.value?.mode,
        () => chatStore.meta.value?.prefixSnapshot?.hash,
        () => chatStore.meta.value?.id,
        () => chatStore.meta.value?.activeContext?.includeFromCreatedAt,
        () => chatStore.meta.value?.activeContext?.summary,
        () => mcpStatusKey(mcp.serverStates.value),
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
    draftMentions,
    setDraftSelection,
    setDraftMentions,
    refreshContextBudget,
  }
}
