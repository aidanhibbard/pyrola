import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { toast } from 'vue-sonner'
import useBrowserHostResize from '@/composables/use-browser-host-resize'
import useBrowserLayoutHide from '@/composables/use-browser-layout-hide'

vi.mock('vue-sonner', () => ({
  toast: {
    error: vi.fn<(...args: unknown[]) => void>(),
  },
}))

describe('use-browser-host-resize', () => {
  let scope: ReturnType<typeof effectScope> | null = null
  let observerCallback: (() => void) | null = null
  const disconnect = vi.fn<() => void>()
  const observe = vi.fn<(el: Element) => void>()

  beforeEach(() => {
    observerCallback = null
    disconnect.mockReset()
    observe.mockReset()
    vi.useFakeTimers()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          observerCallback = callback
        }

        observe(el: Element): void {
          observe(el)
        }

        disconnect(): void {
          disconnect()
        }
      },
    )
  })

  const drainLayoutHide = (): void => {
    const layoutHide = useBrowserLayoutHide()
    while (layoutHide.hidden.value) {
      layoutHide.end()
    }
  }

  afterEach(() => {
    scope?.stop()
    scope = null
    drainLayoutHide()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const run = (hasPage = true, isTabActive = true) => {
    const hostEl = ref<HTMLElement | null>(null)
    const hideCefView = vi.fn<() => Promise<void>>(async () => undefined)
    const resizeToHost = vi.fn<() => Promise<void>>(async () => undefined)
    const sessionId = ref<string | null>('1')
    scope = effectScope()
    const api = scope.run(() =>
      useBrowserHostResize({
        hostEl,
        hasPage: ref(hasPage),
        isTabActive: ref(isTabActive),
        getCefSessionId: () => sessionId.value,
        hideCefView,
        resizeToHost,
      }),
    )
    if (!api) {
      throw new Error('failed to create host resize')
    }
    return { hostEl, hideCefView, resizeToHost, api, sessionId }
  }

  it('skips the first observer tick then hides CEF until layout settles', async () => {
    const host = document.createElement('div')
    Object.defineProperty(host, 'clientWidth', { value: 400, configurable: true })
    Object.defineProperty(host, 'clientHeight', { value: 300, configurable: true })
    const { hostEl, hideCefView, resizeToHost, api } = run()
    hostEl.value = host
    await nextTick()
    expect(observe).toHaveBeenCalled()
    observerCallback?.()
    expect(hideCefView).not.toHaveBeenCalled()

    Object.defineProperty(host, 'clientWidth', { value: 280, configurable: true })
    observerCallback?.()
    expect(hideCefView).toHaveBeenCalledTimes(1)
    expect(api.layoutBusy.value).toBe(true)
    expect(resizeToHost).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(150)
    expect(resizeToHost).toHaveBeenCalledTimes(1)
    expect(api.layoutBusy.value).toBe(false)
  })

  it('does not toast on a successful hide-and-restore cycle', async () => {
    const host = document.createElement('div')
    Object.defineProperty(host, 'clientWidth', { value: 400, configurable: true })
    Object.defineProperty(host, 'clientHeight', { value: 300, configurable: true })
    const { hostEl } = run()
    hostEl.value = host
    await nextTick()
    observerCallback?.()
    Object.defineProperty(host, 'clientWidth', { value: 240, configurable: true })
    observerCallback?.()
    await vi.advanceTimersByTimeAsync(150)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('hides once for layout-hide and restores after the hold ends and layout settles', async () => {
    const host = document.createElement('div')
    Object.defineProperty(host, 'clientWidth', { value: 400, configurable: true })
    Object.defineProperty(host, 'clientHeight', { value: 300, configurable: true })
    const { hostEl, hideCefView, resizeToHost, api } = run()
    hostEl.value = host
    await nextTick()
    observerCallback?.()

    const layoutHide = useBrowserLayoutHide()
    layoutHide.begin()
    expect(hideCefView).toHaveBeenCalledTimes(1)
    expect(api.layoutBusy.value).toBe(true)
    expect(resizeToHost).not.toHaveBeenCalled()

    Object.defineProperty(host, 'clientWidth', { value: 280, configurable: true })
    observerCallback?.()
    Object.defineProperty(host, 'clientWidth', { value: 220, configurable: true })
    observerCallback?.()
    expect(hideCefView).toHaveBeenCalledTimes(1)
    expect(resizeToHost).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(150)
    expect(resizeToHost).not.toHaveBeenCalled()
    expect(api.layoutBusy.value).toBe(true)

    layoutHide.end()
    expect(resizeToHost).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(150)
    expect(resizeToHost).toHaveBeenCalledTimes(1)
    expect(api.layoutBusy.value).toBe(false)
  })

  it('hides an inactive tab on size change and does not resizeToHost after settle', async () => {
    const host = document.createElement('div')
    Object.defineProperty(host, 'clientWidth', { value: 400, configurable: true })
    Object.defineProperty(host, 'clientHeight', { value: 300, configurable: true })
    const { hostEl, hideCefView, resizeToHost } = run(true, false)
    hostEl.value = host
    await nextTick()
    observerCallback?.()
    expect(hideCefView).not.toHaveBeenCalled()

    Object.defineProperty(host, 'clientWidth', { value: 280, configurable: true })
    observerCallback?.()
    expect(hideCefView).toHaveBeenCalled()
    expect(resizeToHost).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(150)
    expect(resizeToHost).not.toHaveBeenCalled()
    expect(hideCefView).toHaveBeenCalled()
  })
})
