import type { Ref } from 'vue'
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import captureElementAtPoint from '@/services/browser/capture-element-at-point'
import type CdpClient from '@/services/browser/cdp-client'
import {
  cleanupElementPickListener,
  installElementPickListener,
  readElementPick,
} from '@/services/browser/inject-element-pick'

type ElementSelectArgs = {
  workspaceId: string
  getCefSessionId: () => string | null
  getClient: () => Promise<CdpClient>
  hasPage: Ref<boolean>
}

const POLL_MS = 100

export default (args: ElementSelectArgs) => {
  const elementSelectMode = ref(false)
  const chatPromptBridge = useChatPromptBridge()
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let picking = false

  const stopPolling = (): void => {
    if (pollTimer !== null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  const cleanupPick = async (): Promise<void> => {
    stopPolling()
    try {
      const client = await args.getClient()
      await cleanupElementPickListener(client)
    } catch {
      // Session may already be gone; ignore cleanup failures.
    }
  }

  const stopElementSelect = (): void => {
    if (!elementSelectMode.value) {
      return
    }
    elementSelectMode.value = false
    cleanupPick().catch((error: unknown) => {
      toast.error('Failed to stop element select', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    })
  }

  const completePick = async (x: number, y: number): Promise<void> => {
    if (picking) {
      return
    }
    picking = true
    elementSelectMode.value = false
    stopPolling()
    try {
      const client = await args.getClient()
      await cleanupElementPickListener(client)
      const selection = await captureElementAtPoint(client, '', x, y)
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

  const startPolling = (client: CdpClient): void => {
    stopPolling()
    pollTimer = setInterval(() => {
      readElementPick(client)
        .then((pick) => {
          if (!pick || !elementSelectMode.value) {
            return
          }
          return completePick(pick.x, pick.y)
        })
        .catch((error: unknown) => {
          toast.error('Failed to read element pick', {
            description:
              error instanceof Error ? error.message : 'Unknown error',
          })
          stopElementSelect()
        })
    }, POLL_MS)
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

    elementSelectMode.value = true
    args
      .getClient()
      .then(async (client) => {
        await installElementPickListener(client)
        if (!elementSelectMode.value) {
          await cleanupElementPickListener(client)
          return
        }
        startPolling(client)
        toast.info('Click an element in the browser')
      })
      .catch((error: unknown) => {
        elementSelectMode.value = false
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
