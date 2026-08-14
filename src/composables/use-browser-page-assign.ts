import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import useFleetSidebar, { chatTitleForId } from '@/composables/use-fleet-sidebar'
import { isHomeChatSlug } from '@/constants/home-chat'
import {
  assignExclusivePreferredSession,
  browserRegistryRevision,
  getPreferredChatIdForSession,
  getSessionLock,
  takeControl,
} from '@/services/browser/registry'
import type { BrowserPageAssignPending } from '@/types/browser/browser-page-assign-pending'
import type { FleetSidebarChat } from '@/types/fleet/fleet-sidebar-chat'

export default (workspaceId: string) => {
  const fleet = useFleetSidebar()
  const pendingMove = ref<BrowserPageAssignPending | null>(null)
  const confirming = ref(false)

  const chats = computed((): FleetSidebarChat[] => {
    if (isHomeChatSlug(workspaceId)) {
      return fleet.standaloneChats.value.map((chat) => ({
        id: chat.id,
        title: chat.title,
        status: chat.status,
        attention: chat.attention ?? null,
      }))
    }
    const project = fleet.sidebarProjects.value.find((item) => item.slug === workspaceId)
    return project?.chats ?? []
  })

  const titleForChat = (chatId: string): string => {
    const fromFleet = chatTitleForId(chatId)
    if (fromFleet) {
      return fromFleet
    }
    const match = chats.value.find((chat) => chat.id === chatId)
    return match?.title || chatId.slice(0, 8)
  }

  const preferredChatIdFor = (sessionId: string): string | null => {
    if (browserRegistryRevision.value < 0) {
      return null
    }
    return getPreferredChatIdForSession(workspaceId, sessionId)
  }

  const preferredLabelFor = (sessionId: string): string | null => {
    const chatId = preferredChatIdFor(sessionId)
    if (!chatId) {
      return null
    }
    return titleForChat(chatId)
  }

  const lockOwnerTitleFor = (sessionId: string): string | null => {
    if (browserRegistryRevision.value < 0) {
      return null
    }
    const lock = getSessionLock(sessionId)
    if (!lock) {
      return null
    }
    return titleForChat(lock.ownerChatId)
  }

  const applyAssign = (chatId: string, sessionId: string): void => {
    assignExclusivePreferredSession(chatId, sessionId)
  }

  const assignToChat = (chatId: string, sessionId: string): void => {
    if (preferredChatIdFor(sessionId) === chatId) {
      return
    }
    const lock = getSessionLock(sessionId)
    if (lock && lock.ownerChatId !== chatId) {
      pendingMove.value = {
        sessionId,
        targetChatId: chatId,
        ownerTitle: titleForChat(lock.ownerChatId),
        targetTitle: titleForChat(chatId),
      }
      return
    }
    applyAssign(chatId, sessionId)
  }

  const confirmPendingMove = (): void => {
    const pending = pendingMove.value
    if (!pending) {
      return
    }
    confirming.value = true
    try {
      takeControl(pending.sessionId)
      applyAssign(pending.targetChatId, pending.sessionId)
      toast.success(`Moved browser to ${pending.targetTitle}`, {
        description: `${pending.ownerTitle} no longer controls this page.`,
      })
    } catch (error) {
      toast.error('Failed to move browser', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      pendingMove.value = null
      confirming.value = false
    }
  }

  const dismissPendingMove = (): void => {
    if (confirming.value) {
      return
    }
    pendingMove.value = null
  }

  const refreshAssignChats = (open: boolean): void => {
    if (!open) {
      return
    }
    fleet.refreshSlug(workspaceId).catch((error: unknown) => {
      toast.error('Failed to load chats', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    })
  }

  return {
    chats,
    pendingMove,
    preferredChatIdFor,
    preferredLabelFor,
    lockOwnerTitleFor,
    assignToChat,
    confirmPendingMove,
    dismissPendingMove,
    refreshAssignChats,
  }
}
