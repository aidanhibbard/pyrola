import { computed } from 'vue'
import { toast } from 'vue-sonner'
import { useRouter } from 'vue-router'
import useChatStore from '@/composables/use-chat-store'
import useWorkbenchStore from '@/composables/use-workbench-store'
import {
  chatProjectSlugForId,
  chatTitleForId,
} from '@/composables/use-fleet-sidebar'
import { HOME_CHAT_SLUG, isHomeChatSlug } from '@/constants/home-chat'
import {
  browserRegistryRevision,
  getSessionLock,
  getSessionWaiters,
  listTabs,
  takeControl,
} from '@/services/browser/registry'
import type { ChatBrowserLockChipState } from '@/types/browser/chat-browser-lock-chip'
import chatRouteFor from '@/utils/chat-route-for'

export default () => {
  const chatStore = useChatStore()
  const workbench = useWorkbenchStore()
  const router = useRouter()

  const projectSlug = computed(() => {
    const slug = chatStore.meta.value?.projectSlug
    if (!slug || slug.length === 0) {
      return HOME_CHAT_SLUG
    }
    return slug
  })

  const chatId = computed(() => chatStore.chatId.value)

  const state = computed((): ChatBrowserLockChipState | null => {
    const revision = browserRegistryRevision.value
    const id = chatId.value
    if (!id || revision < 0) {
      return null
    }

    const tabs = listTabs(projectSlug.value)
    for (const tab of tabs) {
      const lock = getSessionLock(tab.viewId)
      if (lock?.ownerChatId === id) {
        return { kind: 'owner', sessionId: tab.viewId }
      }
    }

    for (const tab of tabs) {
      const queued = getSessionWaiters(tab.viewId).some(
        (waiter) => waiter.chatId === id,
      )
      if (!queued) {
        continue
      }
      const lock = getSessionLock(tab.viewId)
      const ownerChatId = lock?.ownerChatId ?? ''
      return {
        kind: 'queued',
        sessionId: tab.viewId,
        ownerChatId,
        ownerTitle: ownerChatId ? chatTitleForId(ownerChatId) : null,
        ownerProjectSlug:
          (ownerChatId ? chatProjectSlugForId(ownerChatId) : null) ??
          projectSlug.value,
      }
    }

    return null
  })

  const waitingForBrowser = computed(() => state.value?.kind === 'queued')

  const openBrowserTab = async (): Promise<void> => {
    const slug = projectSlug.value
    const projectId = isHomeChatSlug(slug)
      ? slug
      : workbench.resolveProjectIdBySlug(slug)
    if (!projectId) {
      toast.error('Could not open browser tab', {
        description: 'No project is linked to this chat.',
      })
      return
    }
    try {
      await workbench.openBrowser(projectId)
    } catch (error) {
      toast.error('Could not open browser tab', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const unlock = (): void => {
    const current = state.value
    if (current?.kind !== 'owner') {
      return
    }
    try {
      takeControl(current.sessionId)
    } catch (error) {
      toast.error('Failed to unlock browser', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const openOwnerChat = async (): Promise<void> => {
    const current = state.value
    if (current?.kind !== 'queued' || !current.ownerChatId) {
      return
    }
    const slug = current.ownerProjectSlug ?? projectSlug.value
    try {
      await router.push(chatRouteFor(slug, current.ownerChatId))
    } catch (error) {
      toast.error('Could not open owner chat', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return {
    state,
    waitingForBrowser,
    openBrowserTab,
    unlock,
    openOwnerChat,
  }
}
