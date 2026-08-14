import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { toast } from 'vue-sonner'

const SETTLE_MS = 150

type HostResizeArgs = {
  hostEl: Ref<HTMLElement | null>
  hasPage: Ref<boolean>
  getCefSessionId: () => string | null
  hideCefView: () => Promise<void>
  resizeToHost: () => Promise<void>
}

export default (args: HostResizeArgs) => {
  const layoutBusy = ref(false)
  let observer: ResizeObserver | null = null
  let settleTimer: ReturnType<typeof setTimeout> | null = null
  let skipNextObserver = false
  let lastWidth = -1
  let lastHeight = -1

  const report = (title: string, error: unknown): void => {
    toast.error(title, {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }

  const hideQuietly = (): void => {
    args.hideCefView().catch((error: unknown) => {
      report('Failed to hide browser view', error)
    })
  }

  const settle = (): void => {
    settleTimer = null
    const reveal = args.getCefSessionId() && args.hasPage.value
      ? args.resizeToHost()
      : args.hideCefView()
    reveal
      .catch((error: unknown) => {
        report(
          args.hasPage.value
            ? 'Failed to resize browser'
            : 'Failed to hide browser view',
          error,
        )
      })
      .finally(() => {
        layoutBusy.value = false
      })
  }

  const scheduleSettle = (): void => {
    if (settleTimer) {
      clearTimeout(settleTimer)
    }
    settleTimer = setTimeout(settle, SETTLE_MS)
  }

  const beginLayoutHide = (): void => {
    if (!args.getCefSessionId()) {
      hideQuietly()
      return
    }
    if (!args.hasPage.value) {
      hideQuietly()
      return
    }
    if (!layoutBusy.value) {
      layoutBusy.value = true
      hideQuietly()
    }
    scheduleSettle()
  }

  const onHostResized = (): void => {
    const el = args.hostEl.value
    const width = el?.clientWidth ?? 0
    const height = el?.clientHeight ?? 0
    if (skipNextObserver) {
      skipNextObserver = false
      lastWidth = width
      lastHeight = height
      return
    }
    if (width === lastWidth && height === lastHeight) {
      return
    }
    lastWidth = width
    lastHeight = height
    beginLayoutHide()
  }

  const detach = (): void => {
    observer?.disconnect()
    observer = null
    if (settleTimer) {
      clearTimeout(settleTimer)
      settleTimer = null
    }
  }

  const attach = (el: HTMLElement): void => {
    detach()
    skipNextObserver = true
    lastWidth = el.clientWidth
    lastHeight = el.clientHeight
    observer = new ResizeObserver(() => {
      onHostResized()
    })
    observer.observe(el)
  }

  watch(
    args.hostEl,
    (el) => {
      if (!el) {
        detach()
        return
      }
      attach(el)
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    detach()
  })

  return {
    layoutBusy,
  }
}
