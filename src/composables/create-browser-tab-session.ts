import { nextTick, ref, type Ref } from 'vue'
import { toast } from 'vue-sonner'
import createBrowserTabSessionView from '@/composables/create-browser-tab-session-view'
import useBrowserPassthroughSuspend from '@/composables/use-browser-passthrough-suspend'
import type CdpClient from '@/services/browser/cdp-client'
import {
  getSessionCdpClient,
  registerCefSession,
  setLastInteractedViewId,
} from '@/services/browser/registry'
import {
  browserCefCanGoBack,
  browserCefCanGoForward,
  browserCefCreate,
  browserCefGetTitle,
  browserCefGetUrl,
  browserCefResize,
} from '@/services/pyrola/pyrola-tauri/browser'
import type { BrowserTabSessionArgs } from '@/types/browser/browser-tab-session-args'
import type { CefBounds } from '@/types/browser/cef-bounds'
import readBrowserHostBounds from '@/utils/browser-host-bounds'
import {
  BROWSER_HIDDEN_BOUNDS,
  writeBrowserLastUrl,
} from '@/utils/browser-session-storage'
import { displayUrlForAddressBar } from '@/utils/browser-tab-url'
import syncBrowserPassthroughRects from '@/utils/sync-browser-passthrough-rects'

const STATE_POLL_MS = 500

export default (args: BrowserTabSessionArgs) => {
  const cefSessionId: Ref<string | null> = ref(null)
  const passthroughSuspend = useBrowserPassthroughSuspend()
  let created = false
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let lastBounds: CefBounds | null = null

  // CEF sits behind the webview. Passthrough rects route hole clicks to CEF;
  // opaque Vue chrome stays above and keeps hits.
  const syncPassthroughRects = async (): Promise<void> => {
    await syncBrowserPassthroughRects({
      enabled:
        created
        && args.isTabActive.value
        && args.hasPage.value
        && !passthroughSuspend.suspended.value,
      hostEl: args.hostEl.value,
      lastBounds,
    })
  }

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

  const view = createBrowserTabSessionView({
    getSessionId: () => cefSessionId.value,
    isCreated: () => created,
    isTabActive: () => args.isTabActive.value,
    getHostEl: () => args.hostEl.value,
    getLastBounds: () => lastBounds,
    setLastBounds: (bounds) => {
      lastBounds = bounds
    },
    clearSessionId: () => {
      cefSessionId.value = null
    },
    setCreated: (value) => {
      created = value
    },
    setCefReady: (value) => {
      args.cefReady.value = value
    },
    stopPolling,
    syncPassthroughRects,
  })

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
      // Always hide until navigate sets hasPage and showCefView runs. CEF is
      // behind the webview; keep it off-screen and clear passthrough for Empty.
      await browserCefResize(sessionId, BROWSER_HIDDEN_BOUNDS)
      await syncPassthroughRects()
      return true
    } catch (error) {
      toast.error('Failed to create browser view', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
      return false
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
    hideCefView: view.hideCefView,
    showCefView: view.showCefView,
    resizeToHost: view.resizeToHost,
    ensureCefSession,
    destroyCefSession: view.destroyCefSession,
    closeCefView: view.closeCefView,
    markNavigated,
    syncPassthroughRects,
    isCreated: () => created,
    getCdpClient,
    getCefSessionId: () => cefSessionId.value,
  }
}
