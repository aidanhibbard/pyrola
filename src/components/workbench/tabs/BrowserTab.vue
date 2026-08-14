<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { Globe } from '@lucide/vue'
import { toast } from 'vue-sonner'
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
} from '@/components/shadcn/ui/empty'
import useBrowserTab from '@/composables/use-browser-tab'
import type { BrowserPayload, WorkbenchTab } from '@/types/workbench/workbench-tab'

const props = defineProps<{
  tab: WorkbenchTab
}>()

const workspaceId = computed(
  () => (props.tab.payload as BrowserPayload).workspaceId,
)

const {
  starting,
  addressBarValue,
  canBack,
  canForward,
  addressInputRef,
  hostEl,
  cefReady,
  hasPage,
  layoutBusy,
  activeLock,
  lockOwnerTitle,
  lockWaiterCount,
  currentUrl,
  currentTabTitle,
  bookmarks,
  isCurrentBookmarked,
  showBookmarkBar,
  toggleShowBookmarkBar,
  toggleCurrentBookmark,
  removeBookmarkUrl,
  consoleOpen,
  lines,
  clearConsole,
  toggleConsole,
  elementSelectMode,
  elementSelectDisabled,
  toggleElementSelect,
  historyUrls,
  refreshHistoryUrls,
  handleTakeScreenshot,
  handleHardReload,
  handleCopyUrl,
  handleClearBrowsingData,
  handleClearCookies,
  handleClearCache,
  handleTakeControl,
  handleOpenOwnerChat,
  handleNavigate,
  handleBack,
  handleForward,
  handleReload,
  handleAddressBlur,
  bootstrap,
  pages,
  activePageSessionId,
  selectPage,
  closePage,
  addPage,
} = useBrowserTab(workspaceId.value, props.tab.id)

const setAddressInputRef = (el: HTMLInputElement | null): void => {
  addressInputRef.value = el
}

const onToggleBookmark = (): void => {
  toggleCurrentBookmark(currentTabTitle.value)
}

onMounted(() => {
  bootstrap().catch((error: unknown) => {
    toast.error('Failed to start browser', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
    starting.value = false
  })
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <BrowserToolbar
      :starting="starting"
      :can-back="canBack"
      :can-forward="canForward"
      :cef-ready="cefReady"
      :address-bar-value="addressBarValue"
      :is-current-bookmarked="isCurrentBookmarked"
      :current-url="currentUrl"
      :element-select-mode="elementSelectMode"
      :element-select-disabled="elementSelectDisabled"
      :console-open="consoleOpen"
      :show-bookmark-bar="showBookmarkBar"
      :bookmarks="bookmarks"
      :history-urls="historyUrls"
      @update:address-bar-value="addressBarValue = $event"
      @set-address-input-ref="setAddressInputRef"
      @back="handleBack"
      @forward="handleForward"
      @reload="handleReload"
      @blur-address="handleAddressBlur"
      @toggle-bookmark="onToggleBookmark"
      @navigate="handleNavigate()"
      @navigate-url="handleNavigate($event)"
      @toggle-element-select="toggleElementSelect"
      @toggle-console="toggleConsole"
      @take-screenshot="handleTakeScreenshot"
      @hard-reload="handleHardReload"
      @copy-url="handleCopyUrl"
      @toggle-bookmark-bar="toggleShowBookmarkBar"
      @clear-browsing-data="handleClearBrowsingData"
      @clear-cookies="handleClearCookies"
      @clear-cache="handleClearCache"
      @refresh-history="refreshHistoryUrls"
      @remove-bookmark="removeBookmarkUrl"
    />

    <BrowserPageStrip
      :pages="pages"
      :active-session-id="activePageSessionId"
      :workspace-id="workspaceId"
      @select="selectPage"
      @close="closePage"
      @add="addPage"
    />

    <BrowserBookmarkBar
      v-if="showBookmarkBar"
      :bookmarks="bookmarks"
      @navigate="handleNavigate($event)"
      @remove="removeBookmarkUrl"
    />

    <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        class="relative flex min-h-0 flex-1 flex-col overflow-hidden"
        :class="activeLock ? 'agent-aurora-ring border border-transparent' : undefined"
      >
        <!-- Hole is transparent only while a page is showing and layout is idle. -->
        <div
          ref="hostEl"
          class="absolute inset-0 h-full w-full"
          :class="hasPage && !layoutBusy ? '' : 'bg-background'"
          aria-hidden="true"
        />
        <BrowserLockOverlay
          v-if="activeLock"
          :owner-title="lockOwnerTitle"
          :waiter-count="lockWaiterCount"
          @open-chat="handleOpenOwnerChat"
          @take-control="handleTakeControl"
        />
        <Empty
          v-if="!hasPage"
          class="pointer-events-none absolute inset-4 z-10 flex min-h-0 border border-dashed border-border/60 bg-background"
        >
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Globe />
            </EmptyMedia>
            <EmptyContent>
              {{ starting ? 'Starting browser...' : 'No page open' }}
            </EmptyContent>
          </EmptyHeader>
        </Empty>
      </div>
      <BrowserConsolePanel
        v-if="consoleOpen"
        :lines="lines"
        @clear="clearConsole"
        @close="toggleConsole"
      />
    </div>
  </div>
</template>
