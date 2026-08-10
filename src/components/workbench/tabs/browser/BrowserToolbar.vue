<script setup lang="ts">
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Cookie,
  Copy,
  History,
  MoreHorizontal,
  MousePointerClick,
  RotateCw,
  ScrollText,
  Square,
  SquareCheck,
  Star,
  Trash2,
  X,
} from '@lucide/vue'
import { Badge } from '@/components/shadcn/ui/badge'
import { Button } from '@/components/shadcn/ui/button'
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
import type { BrowserBookmark } from '@/services/browser/bookmarks'
import type { BrowserLock } from '@/types/browser/browser-lock'
import { faviconForUrl } from '@/utils/browser-tab-url'

defineProps<{
  starting: boolean
  canBack: boolean
  canForward: boolean
  cefReady: boolean
  addressBarValue: string
  isCurrentBookmarked: boolean
  currentUrl: string
  elementSelectMode: boolean
  elementSelectDisabled?: boolean
  consoleOpen: boolean
  showBookmarkBar: boolean
  bookmarks: BrowserBookmark[]
  historyUrls: string[]
  activeLock: BrowserLock | null
}>()

const emit = defineEmits<{
  'update:addressBarValue': [value: string]
  'set-address-input-ref': [el: HTMLInputElement | null]
  'blur-address': []
  back: []
  forward: []
  reload: []
  'toggle-bookmark': []
  navigate: []
  'navigate-url': [url: string]
  'toggle-element-select': []
  'toggle-console': []
  'take-screenshot': []
  'hard-reload': []
  'copy-url': []
  'toggle-bookmark-bar': []
  'clear-browsing-data': []
  'clear-cookies': []
  'clear-cache': []
  'refresh-history': []
  'remove-bookmark': [url: string]
  'take-control': []
}>()

const setAddressInputRef = (el: unknown): void => {
  emit(
    'set-address-input-ref',
    el instanceof HTMLInputElement ? el : null,
  )
}

const bookmarkLabel = (bookmark: BrowserBookmark): string => {
  if (bookmark.title) {
    return bookmark.title
  }
  try {
    return new URL(bookmark.url).hostname || bookmark.url
  } catch {
    return bookmark.url
  }
}
</script>

<template>
  <div class="flex items-center gap-1 border-b border-border/50 bg-background px-2 py-1.5">
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7"
          :disabled="!canBack || starting"
          @click="emit('back')"
        >
          <ArrowLeft class="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent class="z-60">Go back</TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7"
          :disabled="!canForward || starting"
          @click="emit('forward')"
        >
          <ArrowRight class="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent class="z-60">Go forward</TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7"
          :disabled="!cefReady || starting"
          @click="emit('reload')"
        >
          <RotateCw class="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent class="z-60">Reload</TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7"
          :disabled="!currentUrl || starting"
          @click="emit('toggle-bookmark')"
        >
          <Star
            class="h-4 w-4"
            :class="isCurrentBookmarked ? 'fill-current' : ''"
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent class="z-60">{{ isCurrentBookmarked ? 'Remove bookmark' : 'Add bookmark' }}</TooltipContent>
    </Tooltip>

    <div class="relative mx-1 flex-1">
      <input
        :ref="setAddressInputRef"
        :value="addressBarValue"
        type="text"
        class="h-8 w-full rounded-full bg-muted/50 px-3 text-sm text-foreground outline-none focus:bg-muted"
        placeholder="Enter URL or search"
        :disabled="starting || !cefReady"
        @input="emit('update:addressBarValue', ($event.target as HTMLInputElement).value)"
        @keydown.enter.prevent="emit('navigate')"
        @blur="emit('blur-address')"
      >
    </div>

    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7"
          :class="elementSelectMode ? 'bg-accent text-accent-foreground ring-1 ring-ring' : ''"
          :disabled="elementSelectDisabled || !cefReady || starting"
          @click="emit('toggle-element-select')"
        >
          <MousePointerClick class="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent class="z-60">
        Select element
      </TooltipContent>
    </Tooltip>

    <Tooltip :disable-closing-trigger="true">
      <TooltipTrigger as-child>
        <span class="inline-flex shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                type="button"
                :disabled="starting"
              >
                <MoreHorizontal class="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-52">
              <DropdownMenuItem @click="emit('take-screenshot')">
                <Camera />
                Take screenshot
              </DropdownMenuItem>
              <DropdownMenuItem @click="emit('hard-reload')">
                <RotateCw />
                Hard reload
              </DropdownMenuItem>
              <DropdownMenuItem @click="emit('copy-url')">
                <Copy />
                Copy URL
              </DropdownMenuItem>
              <DropdownMenuItem @click="emit('toggle-console')">
                <ScrollText />
                {{ consoleOpen ? 'Hide console' : 'Show console' }}
              </DropdownMenuItem>
              <DropdownMenuItem @click="emit('toggle-bookmark-bar')">
                <component :is="showBookmarkBar ? SquareCheck : Square" />
                Show bookmark bar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem @click="emit('clear-browsing-data')">
                <History />
                Clear browsing history
              </DropdownMenuItem>
              <DropdownMenuItem @click="emit('clear-cookies')">
                <Cookie />
                Clear cookies
              </DropdownMenuItem>
              <DropdownMenuItem @click="emit('clear-cache')">
                <Trash2 />
                Clear cache
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </TooltipTrigger>
      <TooltipContent class="z-60">More actions</TooltipContent>
    </Tooltip>

    <Tooltip :disable-closing-trigger="true">
      <TooltipTrigger as-child>
        <span class="inline-flex shrink-0">
          <DropdownMenu @update:open="(open) => { if (open) emit('refresh-history') }">
            <DropdownMenuTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                type="button"
                :disabled="starting"
              >
                <History class="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="max-h-72 w-64 overflow-y-auto">
              <template v-if="bookmarks.length > 0">
                <DropdownMenuItem
                  v-for="bookmark in bookmarks"
                  :key="`bm-${bookmark.url}`"
                  class="group flex items-center gap-2"
                  @click="emit('navigate-url', bookmark.url)"
                >
                  <img
                    v-if="faviconForUrl(bookmark.url)"
                    :src="faviconForUrl(bookmark.url) ?? undefined"
                    alt=""
                    class="h-3.5 w-3.5 shrink-0"
                  >
                  <span class="min-w-0 flex-1 truncate">
                    {{ bookmarkLabel(bookmark) }}
                  </span>
                  <span
                    class="rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-accent/50"
                    @click.stop="emit('remove-bookmark', bookmark.url)"
                  >
                    <X class="h-3 w-3" />
                  </span>
                </DropdownMenuItem>
              </template>
              <DropdownMenuItem v-else disabled>
                No bookmarks
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <template v-if="historyUrls.length > 0">
                <DropdownMenuItem
                  v-for="(url, index) in historyUrls"
                  :key="`hist-${index}-${url}`"
                  class="truncate"
                  @click="emit('navigate-url', url)"
                >
                  {{ url }}
                </DropdownMenuItem>
              </template>
              <DropdownMenuItem v-else disabled>
                No history
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </TooltipTrigger>
      <TooltipContent class="z-60">Bookmarks and history</TooltipContent>
    </Tooltip>

    <Badge
      v-if="activeLock"
      variant="secondary"
      class="text-[10px] font-normal"
    >
      Locked by {{ activeLock.ownerChatId.slice(0, 8) }}
    </Badge>
    <Button
      v-if="activeLock"
      variant="ghost"
      size="sm"
      class="h-7"
      @click="emit('take-control')"
    >
      Take Control
    </Button>
  </div>
</template>
