import { ref, watch, type Ref } from 'vue'
import { toast } from 'vue-sonner'
import useChatPromptBridge from '@/composables/use-chat-prompt-bridge'
import captureElementByBackendNodeId from '@/services/browser/capture-element-by-node'
import type CdpClient from '@/services/browser/cdp-client'
import {
  startInspectMode,
  stopInspectMode,
} from '@/services/browser/cdp-inspect-mode'

type ElementSelectArgs = {
  workspaceId: string
  getCefSessionId: () => string | null
  getClient: () => Promise<CdpClient>
  hasPage: Ref<boolean>
}

// CEF connects as a page-target CDP socket. Commands go on the socket root;
// CdpClient omits empty sessionId. The CEF view id is only a presence guard.
const PAGE_TARGET_CDP_SESSION_ID = ''

export default (args: ElementSelectArgs) => {
  const elementSelectMode = ref(false)
  const chatPromptBridge = useChatPromptBridge()
  let picking = false
  let inspectActive = false
  let unsubscribeInspect: (() => void) | null = null
  let infoToastId: string | number | undefined
  let selectGeneration = 0

  const dismissInfoToast = (): void => {
    if (infoToastId === undefined) {
      return
    }
    toast.dismiss(infoToastId)
    infoToastId = undefined
  }

  const clearInspectSubscription = (): void => {
    if (unsubscribeInspect) {
      unsubscribeInspect()
      unsubscribeInspect = null
    }
  }

  const stopInspectForActive = async (): Promise<void> => {
    clearInspectSubscription()
    try {
      const client = await args.getClient()
      await stopInspectMode(client, PAGE_TARGET_CDP_SESSION_ID)
    } catch (error) {
      toast.error('Failed to stop element select', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const stopElementSelect = (): void => {
    if (!elementSelectMode.value) {
      return
    }
    elementSelectMode.value = false
    selectGeneration += 1
    dismissInfoToast()
    const wasInspecting = inspectActive
    inspectActive = false
    if (!wasInspecting) {
      clearInspectSubscription()
      return
    }
    stopInspectForActive().catch((error: unknown) => {
      toast.error('Failed to stop element select', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    })
  }

  const completePick = async (backendNodeId: number): Promise<void> => {
    if (picking) {
      return
    }
    picking = true
    elementSelectMode.value = false
    selectGeneration += 1
    inspectActive = false
    dismissInfoToast()
    clearInspectSubscription()
    try {
      const client = await args.getClient()
      await stopInspectMode(client, PAGE_TARGET_CDP_SESSION_ID)
      const selection = await captureElementByBackendNodeId(
        client,
        PAGE_TARGET_CDP_SESSION_ID,
        backendNodeId,
      )
      chatPromptBridge.appendBrowserElement(selection)
      toast.success('Element added to composer')
    } catch (error) {
      toast.error('Failed to select element', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      picking = false
    }
  }

  const toggleElementSelect = (): void => {
    if (elementSelectMode.value) {
      stopElementSelect()
      return
    }
    if (!args.hasPage.value) {
      toast.error('Open a page before selecting elements')
      return
    }
    if (!args.getCefSessionId()) {
      toast.error('No active browser session', {
        description: args.workspaceId,
      })
      return
    }

    selectGeneration += 1
    const generation = selectGeneration
    elementSelectMode.value = true
    inspectActive = true
    args
      .getClient()
      .then(async (client) => {
        unsubscribeInspect = await startInspectMode(
          client,
          PAGE_TARGET_CDP_SESSION_ID,
          (backendNodeId) => {
            completePick(backendNodeId).catch((error: unknown) => {
              toast.error('Failed to select element', {
                description:
                  error instanceof Error ? error.message : 'Unknown error',
              })
            })
          },
        )
        if (generation !== selectGeneration) {
          inspectActive = false
          clearInspectSubscription()
          await stopInspectMode(client, PAGE_TARGET_CDP_SESSION_ID)
          return
        }
        infoToastId = toast.info('Click an element in the browser')
      })
      .catch((error: unknown) => {
        elementSelectMode.value = false
        inspectActive = false
        clearInspectSubscription()
        dismissInfoToast()
        toast.error('Failed to start element select', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      })
  }

  watch(
    () => args.hasPage.value,
    (hasPage) => {
      if (!hasPage && elementSelectMode.value) {
        stopElementSelect()
      }
    },
  )

  return {
    elementSelectMode,
    toggleElementSelect,
    stopElementSelect,
  }
}
