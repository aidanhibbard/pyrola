import { onMounted, onUnmounted, ref } from 'vue'
import { browserSetVisible } from '@/services/pyrola/pyrola-tauri'

/**
 * Native child webviews paint above the Vue tree. Visibility is therefore an
 * explicit app concern: show only when the Browser pane is active and nothing
 * modal/portal is covering the window.
 *
 * Rust `browser_set_bounds` refuses to move a hidden webview back on-screen;
 * this module is the single place that decides when it may be shown.
 */

const paneActive = ref(false)
const chromeOverlayDepth = ref(0)
const modalBlocking = ref(false)

let syncing: Promise<void> | null = null
let lastAppliedVisible: boolean | null = null
let modalObserver: MutationObserver | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let started = false

/**
 * Anything that portals above the main chrome and must not sit under the
 * native browser webview. Prefer presence of content/overlay nodes (portals
 * unmount when closed) over fragile open-state attribute timing.
 */
const OPEN_BLOCKERS = [
  '[role="alertdialog"]',
  '[role="dialog"]',
  '[data-slot="alert-dialog-content"]',
  '[data-slot="dialog-content"]',
  '[data-slot="sheet-content"]',
  '[data-slot="drawer-content"]',
  '[data-slot="alert-dialog-overlay"]',
  '[data-slot="dialog-overlay"]',
  '[data-slot="sheet-overlay"]',
  '[data-slot="drawer-overlay"]',
  '[data-state="open"][data-slot$="-overlay"]',
].join(', ')

const readModalBlocking = (): boolean => {
  if (typeof document === 'undefined') {
    return false
  }
  return Boolean(document.querySelector(OPEN_BLOCKERS))
}

const desiredVisible = (): boolean =>
  paneActive.value && chromeOverlayDepth.value === 0 && !modalBlocking.value

const syncVisibility = async (): Promise<void> => {
  const visible = desiredVisible()
  const run = async (): Promise<void> => {
    // Always re-assert hide so a raced set_bounds / platform quirk cannot leave
    // the native view covering Vue. Skip redundant show IPC only.
    if (visible && lastAppliedVisible === true) {
      return
    }
    try {
      await browserSetVisible(visible)
      lastAppliedVisible = visible
    } catch {
      // webview may not exist yet
      lastAppliedVisible = null
    }
  }
  syncing = (syncing ?? Promise.resolve()).then(run, run)
  await syncing
}

const refreshModalBlocking = async (): Promise<void> => {
  modalBlocking.value = readModalBlocking()
  await syncVisibility()
}

const startLayerWatch = (): void => {
  if (typeof document === 'undefined' || started) {
    return
  }
  started = true

  modalObserver = new MutationObserver(() => {
    refreshModalBlocking().catch(() => undefined)
  })
  modalObserver.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-state', 'data-slot', 'role', 'aria-hidden', 'style', 'class'],
  })

  // Heal races MutationObserver misses (Presence, layout, IPC ordering).
  pollTimer = setInterval(() => {
    refreshModalBlocking().catch(() => undefined)
  }, 100)

  refreshModalBlocking().catch(() => undefined)
}

const setPaneActive = async (active: boolean): Promise<void> => {
  paneActive.value = active
  lastAppliedVisible = null
  await refreshModalBlocking()
}

const pushChromeOverlay = async (): Promise<void> => {
  chromeOverlayDepth.value += 1
  lastAppliedVisible = null
  await syncVisibility()
}

const popChromeOverlay = async (): Promise<void> => {
  chromeOverlayDepth.value = Math.max(0, chromeOverlayDepth.value - 1)
  lastAppliedVisible = null
  await syncVisibility()
}

const hide = async (): Promise<void> => {
  paneActive.value = false
  chromeOverlayDepth.value = 0
  lastAppliedVisible = null
  await syncVisibility()
}

/** Call once from App so modal detection runs even if Browser tab is not mounted. */
export const useEmbeddedBrowserLayerBootstrap = (): void => {
  onMounted(() => {
    startLayerWatch()
  })
  onUnmounted(() => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    if (modalObserver) {
      modalObserver.disconnect()
      modalObserver = null
    }
    started = false
    lastAppliedVisible = null
  })
}

export default () => {
  startLayerWatch()

  return {
    paneActive,
    modalBlocking,
    desiredVisible,
    setPaneActive,
    pushChromeOverlay,
    popChromeOverlay,
    hide,
    syncVisibility,
    /** @deprecated observer is app-global now */
    retainModalObserver: () => undefined,
    /** @deprecated observer is app-global now */
    releaseModalObserverUser: () => undefined,
  }
}
