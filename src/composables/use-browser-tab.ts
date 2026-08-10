import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
import { toast } from 'vue-sonner'
import createBrowserTabSession from '@/composables/create-browser-tab-session'
import useBrowserBookmarks from '@/composables/use-browser-bookmarks'
import useBrowserConsole from '@/composables/use-browser-console'
import useBrowserElementSelect from '@/composables/use-browser-element-select'
import useBrowserNavigation from '@/composables/use-browser-navigation'
import useBrowserToolbar from '@/composables/use-browser-toolbar'
import useWorkbenchStore from '@/composables/use-workbench-store'
import {
  browserRegistryRevision,
  getSessionLock,
  takeControl,
} from '@/services/browser/registry'

export default (workspaceId: string, tabId: string) => {
  const workbench = useWorkbenchStore()

  const starting = ref(true)
  const addressBarValue = ref('')
  const canBack = ref(false)
  const canForward = ref(false)
  const addressInputRef = ref<HTMLInputElement | null>(null)
  const hostEl = ref<HTMLElement | null>(null)
  const cefReady = ref(false)
  const hasPage = ref(false)
  const pageTitle = ref('')
  const pageUrl = ref('')

  let resizeObserver: ResizeObserver | null = null

  const isTabActive = computed(
    () => workbench.activeTabId.value === tabId,
  )

  const currentUrl = computed(() => {
    if (pageUrl.value && pageUrl.value !== 'about:blank') {
      return pageUrl.value
    }
    return addressBarValue.value.trim()
  })

  const currentTabTitle = computed(() => pageTitle.value || null)

  const session = createBrowserTabSession({
    workspaceId,
    addressBarValue,
    canBack,
    canForward,
    pageTitle,
    pageUrl,
    cefReady,
    hasPage,
    isTabActive,
    addressInputRef,
    hostEl,
  })

  const activeLock = computed(() => {
    const sessionId = session.cefSessionId.value
    const lock = sessionId ? getSessionLock(sessionId) : null
    // Depend on registry revision so Take Control UI updates.
    return browserRegistryRevision.value >= 0 ? lock : null
  })

  const bookmarksApi = useBrowserBookmarks(workspaceId, currentUrl)
  const consoleApi = useBrowserConsole()

  const elementSelect = useBrowserElementSelect({
    workspaceId,
    getCefSessionId: session.getCefSessionId,
    getClient: session.getCdpClient,
    hasPage,
  })

  const reloadBridge = {
    run: async (): Promise<void> => {},
  }

  const toolbar = useBrowserToolbar({
    cefReady,
    currentUrl,
    reload: () => reloadBridge.run(),
  })

  const navigation = useBrowserNavigation({
    cefReady,
    pageUrl,
    addressBarValue,
    addressInputRef,
    ensureCefSession: session.ensureCefSession,
    getCefSessionId: session.getCefSessionId,
    markNavigated: session.markNavigated,
    showCefView: session.showCefView,
    refreshState: session.refreshState,
    startPolling: session.startPolling,
    recordHistoryUrl: toolbar.recordHistoryUrl,
  })
  reloadBridge.run = navigation.handleReload

  const handleTakeControl = (): void => {
    const sessionId = session.getCefSessionId()
    if (!sessionId) {
      toast.error('No browser session to take control of')
      return
    }
    try {
      takeControl(sessionId)
    } catch (error) {
      toast.error('Failed to take control', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const bootstrap = async (): Promise<void> => {
    starting.value = true
    try {
      await session.ensureCefSession()
      if (isTabActive.value) {
        if (hasPage.value) {
          await session.showCefView()
        } else {
          await session.hideCefView()
        }
        session.startPolling()
      }
      try {
        await consoleApi.attachConsole(session.getCdpClient)
      } catch (error) {
        toast.error('Failed to attach browser console', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      }
      if (hasPage.value) {
        toolbar.recordHistoryUrl(pageUrl.value)
      } else {
        await session.focusAddressBar(addressInputRef)
      }
    } catch (error) {
      toast.error('Failed to start browser', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      starting.value = false
    }
  }

  const cleanup = (): void => {
    session.stopPolling()
    elementSelect.stopElementSelect()
    consoleApi.detachConsole()
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    session.destroyCefSession().catch((error: unknown) => {
      toast.error('Failed to close browser view', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    })
  }

  watch(isTabActive, (active) => {
    if (!session.isCreated()) {
      return
    }
    if (active) {
      const reveal = hasPage.value
        ? session.showCefView()
        : session.hideCefView()
      reveal.catch((error: unknown) => {
        toast.error(
          hasPage.value
            ? 'Failed to show browser view'
            : 'Failed to hide browser view',
          {
            description:
              error instanceof Error ? error.message : 'Unknown error',
          },
        )
      })
      session.startPolling()
      return
    }
    session.stopPolling()
    elementSelect.stopElementSelect()
    session.hideCefView().catch((error: unknown) => {
      toast.error('Failed to hide browser view', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    })
  })

  const attachResizeObserver = (el: HTMLElement): void => {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    resizeObserver = new ResizeObserver(() => {
      session.resizeToHost().catch((error: unknown) => {
        toast.error('Failed to resize browser', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      })
    })
    resizeObserver.observe(el)
  }

  watch(hostEl, (el) => {
    if (!el) {
      resizeObserver?.disconnect()
      resizeObserver = null
      return
    }
    attachResizeObserver(el)
  })

  onMounted(() => {
    if (hostEl.value && !resizeObserver) {
      attachResizeObserver(hostEl.value)
    }
  })

  onBeforeUnmount(() => {
    cleanup()
  })

  const handleAddressBlur = (): void => {
    session.resyncAddressBar()
  }

  return {
    starting,
    addressBarValue,
    canBack,
    canForward,
    addressInputRef,
    hostEl,
    cefReady,
    hasPage,
    activeLock,
    currentUrl,
    currentTabTitle,
    elementSelectMode: elementSelect.elementSelectMode,
    elementSelectDisabled: false,
    toggleElementSelect: elementSelect.toggleElementSelect,
    handleTakeControl,
    handleNavigate: navigation.handleNavigate,
    handleBack: navigation.handleBack,
    handleForward: navigation.handleForward,
    handleReload: navigation.handleReload,
    handleAddressBlur,
    bootstrap,
    cleanup,
    ...bookmarksApi,
    consoleOpen: consoleApi.consoleOpen,
    lines: consoleApi.lines,
    clearConsole: consoleApi.clearConsole,
    toggleConsole: consoleApi.toggleConsole,
    ...toolbar,
  }
}
