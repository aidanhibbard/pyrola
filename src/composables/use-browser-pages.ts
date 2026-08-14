import { computed, watch } from 'vue'
import { toast } from 'vue-sonner'
import createCefSession from '@/services/browser/create-cef-session'
import destroyCefSession from '@/services/browser/destroy-cef-session'
import {
  browserRegistryRevision,
  getLastInteractedViewId,
  listTabs,
  setLastInteractedViewId,
} from '@/services/browser/registry'

type PagesArgs = {
  workspaceId: string
  getActiveSessionId: () => string | null
  switchToSession: (sessionId: string) => Promise<void>
  detachActiveSession: () => Promise<void>
}

export default (args: PagesArgs) => {
  const pages = computed(() => {
    const revision = browserRegistryRevision.value
    return revision >= 0 ? listTabs(args.workspaceId) : []
  })

  const activeSessionId = computed(() => args.getActiveSessionId())

  const selectPage = async (sessionId: string): Promise<void> => {
    try {
      setLastInteractedViewId(args.workspaceId, sessionId)
      await args.switchToSession(sessionId)
    } catch (error) {
      toast.error('Failed to switch page', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const closePage = async (sessionId: string): Promise<void> => {
    try {
      if (args.getActiveSessionId() === sessionId) {
        await args.detachActiveSession()
      }
      await destroyCefSession(sessionId)
      const remaining = listTabs(args.workspaceId)
      const next = remaining[remaining.length - 1]
      if (next) {
        setLastInteractedViewId(args.workspaceId, next.viewId)
        await args.switchToSession(next.viewId)
        return
      }
      await args.switchToSession('')
    } catch (error) {
      toast.error('Failed to close page', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const addPage = async (): Promise<void> => {
    try {
      const sessionId = await createCefSession(args.workspaceId)
      setLastInteractedViewId(args.workspaceId, sessionId)
      await args.switchToSession(sessionId)
    } catch (error) {
      toast.error('Failed to open page', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  watch(
    () => getLastInteractedViewId(args.workspaceId),
    (last: string | null) => {
      if (!last || last === args.getActiveSessionId()) {
        return
      }
      args.switchToSession(last).catch((error: unknown) => {
        toast.error('Failed to show browser page', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      })
    },
  )

  return {
    pages,
    activeSessionId,
    selectPage,
    closePage,
    addPage,
  }
}
