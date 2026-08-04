<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Cookie,
  Copy,
  Database,
  Ellipsis,
  History,
  Lock,
  PenTool,
  RefreshCw,
  Share2,
  Unlock,
} from '@lucide/vue'
import { Button } from '@/components/shadcn/ui/button'
import { Input } from '@/components/shadcn/ui/input'
import { Badge } from '@/components/shadcn/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shadcn/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/shadcn/ui/tooltip'
import useChatPromptBridge from '@/composables/use-chat-prompt-bridge'
import useEmbeddedBrowserLayer from '@/composables/use-embedded-browser-layer'
import useWorkbenchStore from '@/composables/use-workbench-store'
import {
  browserRequest,
  browserSetBounds,
  browserStart,
  browserStatus,
  browserUnlock,
} from '@/services/pyrola/pyrola-tauri'
import type { BrowserPayload, WorkbenchTab } from '@/types/workbench/workbench-tab'

const props = defineProps<{
  tab: WorkbenchTab
}>()

const workbench = useWorkbenchStore()
const browserLayer = useEmbeddedBrowserLayer()
const promptBridge = useChatPromptBridge()

const urlInput = ref(
  (() => {
    const initial = (props.tab.payload as BrowserPayload).url || ''
    if (!initial || initial === 'https://' || initial.startsWith('data:text/html')) {
      return ''
    }
    return initial
  })(),
)
const urlFocused = ref(false)
const running = ref(false)
const selecting = ref(false)
const lockHolder = ref<string | null>(null)
const shared = ref(false)
const busy = ref(false)
const title = ref('')
const paneRef = ref<HTMLElement | null>(null)
const actionsOpen = ref(false)
let alive = true

const isPlaceholderUrl = (url: string): boolean =>
  !url ||
  url === 'about:blank' ||
  url === 'https://' ||
  url.startsWith('data:text/html')

const addressFromPage = (url: string): string => (isPlaceholderUrl(url) ? '' : url)

const normalizeNavigateUrl = (raw: string): string => {
  const trimmed = raw.trim()
  if (!trimmed) {
    return 'about:blank'
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return trimmed
  }
  return `https://${trimmed}`
}

const onActionsOpenChange = async (open: boolean): Promise<void> => {
  actionsOpen.value = open
  if (open) {
    await browserLayer.pushChromeOverlay()
  } else {
    await browserLayer.popChromeOverlay()
  }
}

const syncBounds = async (): Promise<void> => {
  if (!alive || !paneRef.value) {
    return
  }
  const rect = paneRef.value.getBoundingClientRect()
  if (rect.width < 2 || rect.height < 2) {
    return
  }
  // Always publish the host rect (Rust stores it even while parked). Live
  // position is only applied when the layer compositor allows visibility.
  await browserSetBounds({
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  })
  await browserLayer.syncVisibility()
}

const refreshStatus = async (): Promise<void> => {
  if (!alive) {
    return
  }
  const status = await browserStatus()
  if (!alive) {
    return
  }
  running.value = status.running
  if (status.url && !urlFocused.value) {
    urlInput.value = addressFromPage(status.url)
  }
  if (status.title) {
    title.value = status.title
  }
  const locks = status.locks ?? {}
  lockHolder.value = locks.main ?? null
  if (status.title) {
    title.value = status.title
    workbench.updateBrowserTabLabel(status.title, status.url ?? undefined)
  }
}

const activatePane = async (): Promise<void> => {
  if (!alive) {
    return
  }
  await syncBounds()
  await browserLayer.setPaneActive(true)
}

const ensureRunning = async (): Promise<void> => {
  if (!alive) {
    return
  }
  const status = await browserStatus()
  if (!alive) {
    return
  }
  if (!status.running) {
    await browserStart()
  }
  if (!alive) {
    await browserLayer.hide()
    return
  }
  running.value = true
  await activatePane()
  await refreshStatus()
}

const withBusy = async (fn: () => Promise<void>): Promise<void> => {
  if (busy.value) {
    return
  }
  busy.value = true
  try {
    await fn()
  } catch (error) {
    toast.error('Browser action failed', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    busy.value = false
  }
}

const navigate = async (): Promise<void> => {
  await withBusy(async () => {
    await ensureRunning()
    const target = normalizeNavigateUrl(urlInput.value)
    urlFocused.value = false
    const result = (await browserRequest({
      method: 'navigate',
      params: { url: target, tabId: 'main' },
    })) as { url?: string }
    if (result.url) {
      urlInput.value = addressFromPage(result.url)
    }
    await refreshStatus()
  })
}

const go = async (method: 'goBack' | 'goForward' | 'reload' | 'hardReload'): Promise<void> => {
  await withBusy(async () => {
    await ensureRunning()
    await browserRequest({ method, params: { tabId: 'main' } })
    await refreshStatus()
  })
}

const toggleShare = async (): Promise<void> => {
  const next = !shared.value
  await withBusy(async () => {
    await ensureRunning()
    await browserRequest({
      method: 'setShared',
      params: { tabId: 'main', shared: next },
    })
    shared.value = next
  })
}

const takeControl = async (): Promise<void> => {
  await withBusy(async () => {
    await browserUnlock('main', 'user')
    lockHolder.value = null
    toast.success('Took control of browser')
  })
}

const takeScreenshot = async (): Promise<void> => {
  await withBusy(async () => {
    await ensureRunning()
    const shot = (await browserRequest({
      method: 'screenshot',
      params: { tabId: 'main' },
    })) as { path?: string }
    if (shot.path) {
      toast.success('Screenshot saved', { description: shot.path })
    }
  })
}

const copyCurrentUrl = async (): Promise<void> => {
  const url = urlInput.value || 'about:blank'
  try {
    await navigator.clipboard.writeText(url)
    toast.success('URL copied')
  } catch (error) {
    toast.error('Failed to copy URL', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const clearCookies = async (): Promise<void> => {
  await withBusy(async () => {
    await ensureRunning()
    await browserRequest({ method: 'clearCookies', params: {} })
    toast.success('Cookies cleared')
  })
}

const clearCache = async (): Promise<void> => {
  await withBusy(async () => {
    await ensureRunning()
    await browserRequest({ method: 'clearCache', params: { tabId: 'main' } })
    toast.success('Cache cleared')
  })
}

const clearHistory = async (): Promise<void> => {
  await withBusy(async () => {
    await ensureRunning()
    await browserRequest({ method: 'clearHistory', params: {} })
    urlInput.value = ''
    toast.success('Browsing history cleared')
  })
}

const startSelect = async (): Promise<void> => {
  selecting.value = true
  try {
    await ensureRunning()
    const result = (await browserRequest({
      method: 'selectElement.start',
      params: { tabId: 'main' },
    })) as {
      tabId?: string
      url?: string
      selector?: string
      role?: string
      name?: string
      outerHTML?: string
      htmlSnippet?: string
      boundingBox?: { x: number; y: number; width: number; height: number }
      screenshotPath?: string
      cropScreenshotPath?: string
    }
    promptBridge.attachBrowserElement({
      tabId: result.tabId ?? 'main',
      url: result.url ?? urlInput.value,
      selector: result.selector ?? '',
      role: result.role,
      name: result.name,
      htmlSnippet: result.htmlSnippet ?? result.outerHTML,
      boundingBox: result.boundingBox,
      cropScreenshotPath: result.cropScreenshotPath ?? result.screenshotPath,
    })
    if (!(result.selector && result.selector.trim())) {
      toast.error('Element selected without a usable selector')
    } else {
      toast.success('Element attached to current chat')
    }
  } catch (error) {
    toast.error('Element select failed', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    selecting.value = false
  }
}

const cancelSelect = async (): Promise<void> => {
  try {
    await browserRequest({
      method: 'selectElement.cancel',
      params: { tabId: 'main' },
    })
  } catch {
    // ignore
  }
  selecting.value = false
}

let unlistenNav: UnlistenFn | null = null
let resizeObserver: ResizeObserver | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  alive = true
  try {
    await ensureRunning()
  } catch (error) {
    running.value = false
    toast.error('Failed to start browser', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }

  unlistenNav = await listen<{ tabId?: string; url?: string; title?: string }>(
    'browser-navigated',
    (event) => {
      if (!alive) {
        return
      }
      if (event.payload.url && !urlFocused.value) {
        urlInput.value = addressFromPage(event.payload.url)
      }
      if (event.payload.title) {
        title.value = event.payload.title
      }
      workbench.updateBrowserTabLabel(
        event.payload.title ?? '',
        event.payload.url,
      )
    },
  )

  pollTimer = setInterval(() => {
    if (alive && running.value) {
      refreshStatus().catch(() => undefined)
    }
  }, 3000)

  await nextTick()
  if (paneRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      if (!alive) {
        return
      }
      syncBounds().catch(() => undefined)
    })
    resizeObserver.observe(paneRef.value)
    await syncBounds()
  }
})

onUnmounted(() => {
  alive = false
  if (pollTimer) {
    clearInterval(pollTimer)
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (unlistenNav) {
    unlistenNav()
  }
  if (selecting.value) {
    cancelSelect().catch(() => undefined)
  }
  browserLayer.hide().catch(() => undefined)
})

watch(
  () => workbench.rightSidebarOpen.value,
  async (open) => {
    if (!alive) {
      return
    }
    if (open) {
      await activatePane()
    } else {
      await browserLayer.setPaneActive(false)
    }
  },
)

watch(
  () => (props.tab.payload as BrowserPayload).url,
  (url) => {
    if (urlFocused.value || !url || isPlaceholderUrl(url)) {
      return
    }
    if (url !== urlInput.value) {
      urlInput.value = url
    }
  },
)
</script>

<template>
  <div class="relative z-[52] flex h-full min-h-0 flex-col bg-background">
    <div class="relative z-[53] flex shrink-0 items-center gap-0.5 border-b border-border/50 px-2 py-1.5">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="size-7"
            :disabled="busy"
            aria-label="Go back"
            @click="go('goBack')"
          >
            <ArrowLeft class="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent class="z-[100]">Go back</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="size-7"
            :disabled="busy"
            aria-label="Go forward"
            @click="go('goForward')"
          >
            <ArrowRight class="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent class="z-[100]">Go forward</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="size-7"
            :disabled="busy"
            aria-label="Reload"
            @click="go('reload')"
          >
            <RefreshCw class="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent class="z-[100]">Reload</TooltipContent>
      </Tooltip>

      <Input
        v-model="urlInput"
        class="h-7 min-w-0 flex-1 rounded-md border-border/60 bg-muted/40 font-mono text-xs shadow-none"
        placeholder="Search or enter URL"
        @focus="urlFocused = true"
        @blur="urlFocused = false"
        @keydown.enter="navigate"
      />

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="size-7"
            :disabled="busy"
            :aria-label="shared ? 'Shared with agents' : 'Share with agents'"
            @click="toggleShare"
          >
            <Share2 class="size-3.5" :class="shared ? 'text-primary' : ''" />
          </Button>
        </TooltipTrigger>
        <TooltipContent class="z-[100]">
          {{ shared ? 'Shared with agents' : 'Share with agents' }}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="size-7"
            :disabled="busy || selecting"
            :aria-label="selecting ? 'Cancel select' : 'Select element'"
            @click="selecting ? cancelSelect() : startSelect()"
          >
            <PenTool class="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent class="z-[100]">
          {{ selecting ? 'Cancel select' : 'Select element' }}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="size-7"
            :disabled="busy"
            aria-label="Take control"
            @click="takeControl"
          >
            <Unlock class="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent class="z-[100]">Take control</TooltipContent>
      </Tooltip>

      <Tooltip :disable-closing-trigger="true">
        <TooltipTrigger as-child>
          <span class="inline-flex shrink-0">
            <DropdownMenu :open="actionsOpen" @update:open="onActionsOpenChange">
              <DropdownMenuTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-7"
                  aria-label="Browser actions"
                >
                  <Ellipsis class="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" class="z-[100] w-56">
                <DropdownMenuItem :disabled="busy" @click="takeScreenshot">
                  <Camera class="mr-2 size-4" />
                  Take Screenshot
                </DropdownMenuItem>
                <DropdownMenuItem :disabled="busy" @click="go('hardReload')">
                  <RefreshCw class="mr-2 size-4" />
                  Hard Reload
                </DropdownMenuItem>
                <DropdownMenuItem @click="copyCurrentUrl">
                  <Copy class="mr-2 size-4" />
                  Copy Current URL
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem :disabled="busy" @click="clearHistory">
                  <History class="mr-2 size-4" />
                  Clear Browsing History
                </DropdownMenuItem>
                <DropdownMenuItem :disabled="busy" @click="clearCookies">
                  <Cookie class="mr-2 size-4" />
                  Clear Cookies
                </DropdownMenuItem>
                <DropdownMenuItem :disabled="busy" @click="clearCache">
                  <Database class="mr-2 size-4" />
                  Clear Cache
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        </TooltipTrigger>
        <TooltipContent class="z-[100]">Browser actions</TooltipContent>
      </Tooltip>
    </div>

    <div
      v-if="lockHolder || selecting"
      class="relative z-[53] flex shrink-0 items-center gap-2 border-b border-border/40 px-2 py-1"
    >
      <Badge
        v-if="lockHolder"
        variant="secondary"
        class="text-[10px] font-normal"
      >
        <Lock class="mr-1 size-2.5" />
        Locked by {{ lockHolder }}
      </Badge>
      <Badge
        v-if="selecting"
        variant="secondary"
        class="text-[10px] font-normal"
      >
        Selecting element…
      </Badge>
    </div>

    <div
      ref="paneRef"
      class="relative min-h-0 flex-1 overflow-hidden bg-background"
    >
      <div
        v-if="!running"
        class="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center"
      >
        <p class="text-sm font-medium">Browser offline</p>
        <p class="max-w-sm text-sm text-muted-foreground">
          Start the embedded browser to open pages in this pane.
        </p>
        <Button size="sm" :disabled="busy" @click="ensureRunning">
          Start browser
        </Button>
      </div>
    </div>
  </div>
</template>
