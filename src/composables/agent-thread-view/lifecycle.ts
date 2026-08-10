import { onMounted, onUnmounted, watch } from 'vue'
import { toast } from 'vue-sonner'
import { PENDING_CHAT_MESSAGE_EVENT } from '@/services/chat/pending-message'
import type { AgentThreadHandlers } from './handlers'
import type { AgentThreadSessionOps } from './session'
import type { AgentThreadViewState } from './types'

export const bindAgentThreadLifecycle = (
  state: AgentThreadViewState,
  session: AgentThreadSessionOps,
  handlers: AgentThreadHandlers,
): void => {
  watch(
    [state.harnessStatus, state.threadReady, state.isSubagentView],
    () => {
      if (state.isSubagentView.value) {
        state.contextActions.clear()
        return
      }
      state.contextActions.register({
        onCompact: () => {
          handlers.handleCompact().catch((error) => {
            toast.error('Failed to compact chat', {
              description: error instanceof Error ? error.message : 'Unknown error',
            })
          })
        },
        onHandoff: () => {
          handlers.handleHandoff().catch((error) => {
            toast.error('Failed to hand off chat', {
              description: error instanceof Error ? error.message : 'Unknown error',
            })
          })
        },
      })
      state.contextActions.setDisabled({
        triggerDisabled: !state.threadReady.value,
        actionsDisabled:
          !state.threadReady.value ||
          state.harnessStatus.value === 'streaming' ||
          state.harnessStatus.value === 'submitted',
      })
    },
    { immediate: true },
  )

  watch(
    () => state.config.hydrated.value,
    (hydrated) => {
      if (!hydrated || state.permissionLevelTouched.value) {
        return
      }
      state.sessionPermissionLevel.value =
        state.config.effectiveSettings.value['agent.permissionLevel'] ?? 'allowlist'
      state.harness.value?.setPermissionLevel(state.sessionPermissionLevel.value)
    },
    { immediate: true },
  )

  let removePendingListener: (() => void) | null = null

  onMounted(() => {
    const handlePendingMessageEvent = (): void => {
      session.flushPendingChatMessage().catch((error) => {
        toast.error('Failed to start plan build', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      })
    }
    window.addEventListener(PENDING_CHAT_MESSAGE_EVENT, handlePendingMessageEvent)
    removePendingListener = () => {
      window.removeEventListener(PENDING_CHAT_MESSAGE_EVENT, handlePendingMessageEvent)
    }

    session.loadThread().catch((error) => {
      toast.error('Failed to load chat', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    })
  })

  onUnmounted(() => {
    removePendingListener?.()
    removePendingListener = null
    state.contextActions.clear()
  })

  watch(
    [state.projectSlug, state.chatId, () => state.fleet.loaded.value, state.isStandalone],
    () => {
      session.loadThread().catch((error) => {
        toast.error('Failed to load chat', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      })
    },
  )
}
