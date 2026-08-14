import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { toast } from 'vue-sonner'
import useBrowserLayoutHide from '@/composables/use-browser-layout-hide'

const SETTLE_MS = 150

type HostResizeArgs = {
  hostEl: Ref<HTMLElement | null>
  hasPage: Ref<boolean>
  isTabActive: Ref<boolean>
  getCefSessionId: () => string | null
  hideCefView: () => Promise<void>
  resizeToHost: () => Promise<void>
}

export default (args: HostResizeArgs) => {
  const layoutHide = useBrowserLayoutHide()
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
    if (layoutHide.hidden.value) {
      return
    }
    const shouldReveal =
      Boolean(args.getCefSessionId())
      && args.hasPage.value
      && args.isTabActive.value
    const reveal = shouldReveal ? args.resizeToHost() : args.hideCefView()
    reveal
      .catch((error: unknown) => {
        report(
          shouldReveal
            ? 'Failed to resize browser'
            : 'Failed to hide browser view',
          error,
        )
      })
      .finally(() => {
        if (layoutHide.hidden.value) {
          hideQuietly()
          return
        }
        layoutBusy.value = false
      })
  }

  const cancelSettle = (): void => {
    if (settleTimer) {
      clearTimeout(settleTimer)
      settleTimer = null
    }
  }

  const scheduleSettle = (): void => {
    cancelSettle()
    settleTimer = setTimeout(settle, SETTLE_MS)
  }

  const beginLayoutHide = (schedule: boolean): void => {
    if (
      !args.getCefSessionId()
      || !args.hasPage.value
      || !args.isTabActive.value
    ) {
      hideQuietly()
      if (schedule) {
        scheduleSettle()
      }
      return
    }
    if (!layoutBusy.value) {
      layoutBusy.value = true
      hideQuietly()
    }
    if (schedule) {
      scheduleSettle()
    }
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
    beginLayoutHide(!layoutHide.hidden.value)
  }

  const detach = (): void => {
    observer?.disconnect()
    observer = null
    cancelSettle()
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

  watch(
    () => layoutHide.hidden.value,
    (hidden) => {
      if (hidden) {
        cancelSettle()
        beginLayoutHide(false)
        return
      }
      scheduleSettle()
    },
    { flush: 'sync' },
  )

  onBeforeUnmount(() => {
    detach()
  })

  return {
    layoutBusy,
  }
}
