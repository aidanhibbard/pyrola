import { nextTick, ref, type Ref } from 'vue'
import { toast } from 'vue-sonner'
import type CdpClient from '@/services/browser/cdp-client'
import {
  getSessionCdpClient,
  registerCefSession,
  setLastInteractedViewId,
  unregisterCefSession,
} from '@/services/browser/registry'
import {
  browserCefCanGoBack,
  browserCefCanGoForward,
  browserCefCreate,
  browserCefDestroy,
  browserCefGetTitle,
  browserCefGetUrl,
  browserCefResize,
} from '@/services/pyrola/pyrola-tauri/browser'
import type { CefBounds } from '@/types/browser/cef-bounds'
import readBrowserHostBounds from '@/utils/browser-host-bounds'
import {
  BROWSER_HIDDEN_BOUNDS,
  writeBrowserLastUrl,
} from '@/utils/browser-session-storage'
import { displayUrlForAddressBar } from '@/utils/browser-tab-url'

const STATE_POLL_MS = 500

type SessionArgs = {
  workspaceId: string
  addressBarValue: Ref<string>
  canBack: Ref<boolean>
  canForward: Ref<boolean>
  pageTitle: Ref<string>
  pageUrl: Ref<string>
  cefReady: Ref<boolean>
  hasPage: Ref<boolean>
  isTabActive: Ref<boolean>
  addressInputRef: Ref<HTMLInputElement | null>
  hostEl: Ref<HTMLElement | null>
}

export default (args: SessionArgs) => {
  const cefSessionId: Ref<string | null> = ref(null)
  let created = false
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let lastBounds: CefBounds | null = null

  const focusAddressBar = async (
    addressInputRef: Ref<HTMLInputElement | null>,
  ): Promise<void> => {
    await nextTick()
    addressInputRef.value?.focus()
    addressInputRef.value?.select()
  }

  const applyState = (state: {
    url: string
    title: string
    canGoBack: boolean
    canGoForward: boolean
  }): void => {
    args.pageUrl.value = state.url
    args.pageTitle.value = state.title
    args.canBack.value = state.canGoBack
    args.canForward.value = state.canGoForward
    args.hasPage.value = Boolean(state.url && state.url !== 'about:blank')
    // Do not clobber the address bar while the user is editing it. The poll
    // runs every 500ms; without this guard typing is impossible because the
    // bar snaps back to the current page URL on every tick.
    const editing = args.addressInputRef.value !== null
      && document.activeElement === args.addressInputRef.value
    if (!editing) {
      args.addressBarValue.value = displayUrlForAddressBar(state.url)
    }
    if (args.hasPage.value) {
      writeBrowserLastUrl(args.workspaceId, state.url)
    }
    const sessionId = cefSessionId.value
    if (sessionId) {
      registerCefSession({
        sessionId,
        workspaceId: args.workspaceId,
        url: state.url,
        title: state.title || null,
      })
    }
  }

  const resyncAddressBar = (): void => {
    args.addressBarValue.value = displayUrlForAddressBar(args.pageUrl.value)
  }

  const refreshState = async (): Promise<void> => {
    const sessionId = cefSessionId.value
    if (!created || !sessionId) {
      return
    }
    try {
      const [url, title, back, forward] = await Promise.all([
        browserCefGetUrl(sessionId),
        browserCefGetTitle(sessionId),
        browserCefCanGoBack(sessionId),
        browserCefCanGoForward(sessionId),
      ])
      applyState({
        url,
        title,
        canGoBack: back,
        canGoForward: forward,
      })
    } catch (error) {
      toast.error('Failed to read browser state', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const stopPolling = (): void => {
    if (pollTimer !== null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  const startPolling = (): void => {
    stopPolling()
    if (!created || !args.isTabActive.value) {
      return
    }
    pollTimer = setInterval(() => {
      refreshState().catch((error: unknown) => {
        toast.error('Failed to sync browser state', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      })
    }, STATE_POLL_MS)
  }

  const getCdpClient = async (): Promise<CdpClient> => {
    const sessionId = cefSessionId.value
    if (!sessionId) {
      throw new Error('CEF session is not ready')
    }
    return getSessionCdpClient(sessionId)
  }

  const ensureCefSession = async (bounds?: CefBounds): Promise<boolean> => {
    if (created && cefSessionId.value) {
      if (bounds) {
        lastBounds = bounds
        if (args.isTabActive.value) {
          try {
            await browserCefResize(cefSessionId.value, bounds)
          } catch (error) {
            toast.error('Failed to resize browser', {
              description:
                error instanceof Error ? error.message : 'Unknown error',
            })
          }
        }
      }
      return true
    }

    const resolved =
      bounds
      ?? readBrowserHostBounds(args.hostEl.value)
      ?? { x: 0, y: 0, width: 1, height: 1 }

    try {
      const sessionId = await browserCefCreate(resolved)
      cefSessionId.value = sessionId
      created = true
      lastBounds = resolved
      registerCefSession({
        sessionId,
        workspaceId: args.workspaceId,
        url: 'about:blank',
        title: null,
      })
      setLastInteractedViewId(args.workspaceId, sessionId)
      args.cefReady.value = true
      args.hasPage.value = false
      args.addressBarValue.value = ''
      args.pageUrl.value = 'about:blank'
      // Always hide until navigate sets hasPage and showCefView runs. Native
      // CEF composites above the webview, so an on-screen view would cover Empty.
      await browserCefResize(sessionId, BROWSER_HIDDEN_BOUNDS)
      return true
    } catch (error) {
      toast.error('Failed to create browser view', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
      return false
    }
  }

  const resizeToHost = async (): Promise<void> => {
    const sessionId = cefSessionId.value
    if (!sessionId || !args.isTabActive.value) {
      return
    }
    const bounds = readBrowserHostBounds(args.hostEl.value)
    if (!bounds) {
      return
    }
    lastBounds = bounds
    try {
      await browserCefResize(sessionId, bounds)
    } catch (error) {
      toast.error('Failed to resize browser', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const hideCefView = async (): Promise<void> => {
    const sessionId = cefSessionId.value
    if (!sessionId) {
      return
    }
    try {
      await browserCefResize(sessionId, BROWSER_HIDDEN_BOUNDS)
    } catch (error) {
      toast.error('Failed to hide browser view', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const showCefView = async (): Promise<void> => {
    if (!created || !cefSessionId.value) {
      return
    }
    if (!args.isTabActive.value) {
      await hideCefView()
      return
    }
    const bounds = readBrowserHostBounds(args.hostEl.value) ?? lastBounds
    if (!bounds) {
      return
    }
    lastBounds = bounds
    try {
      await browserCefResize(cefSessionId.value, bounds)
    } catch (error) {
      toast.error('Failed to show browser view', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const destroyCefSession = async (): Promise<void> => {
    stopPolling()
    const sessionId = cefSessionId.value
    cefSessionId.value = null
    created = false
    args.cefReady.value = false
    if (!sessionId) {
      return
    }
    unregisterCefSession(sessionId)
    try {
      await browserCefDestroy(sessionId)
    } catch (error) {
      toast.error('Failed to destroy browser view', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  // Hide the native CEF child view; keep the session alive until unmount.
  const closeCefView = async (): Promise<void> => {
    stopPolling()
    try {
      await hideCefView()
    } catch (error) {
      toast.error('Failed to close browser view', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const markNavigated = (url: string): void => {
    args.hasPage.value = url !== 'about:blank'
    args.pageUrl.value = url
    args.addressBarValue.value = displayUrlForAddressBar(url)
    writeBrowserLastUrl(args.workspaceId, url)
    const sessionId = cefSessionId.value
    if (sessionId) {
      registerCefSession({
        sessionId,
        workspaceId: args.workspaceId,
        url,
      })
      setLastInteractedViewId(args.workspaceId, sessionId)
    }
  }

  return {
    cefSessionId,
    focusAddressBar,
    refreshState,
    resyncAddressBar,
    startPolling,
    stopPolling,
    hideCefView,
    showCefView,
    resizeToHost,
    ensureCefSession,
    destroyCefSession,
    closeCefView,
    markNavigated,
    isCreated: () => created,
    getCdpClient,
    getCefSessionId: () => cefSessionId.value,
  }
}
