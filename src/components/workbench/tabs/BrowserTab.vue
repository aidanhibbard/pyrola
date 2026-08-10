<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { Globe } from '@lucide/vue'
import { toast } from 'vue-sonner'
import WorkbenchTabsBrowserBookmarkBar from '@/components/workbench/tabs/browser/BrowserBookmarkBar.vue'
import WorkbenchTabsBrowserConsolePanel from '@/components/workbench/tabs/browser/BrowserConsolePanel.vue'
import WorkbenchTabsBrowserToolbar from '@/components/workbench/tabs/browser/BrowserToolbar.vue'
import { Empty, EmptyContent, EmptyHeader, EmptyMedia } from '@/components/shadcn/ui/empty'
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
  activeLock,
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
  handleNavigate,
  handleBack,
  handleForward,
  handleReload,
  handleAddressBlur,
  bootstrap,
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
  <div class="flex h-full min-h-0 flex-col bg-background">
    <WorkbenchTabsBrowserToolbar
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
      :active-lock="activeLock"
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
      @take-control="handleTakeControl"
    />

    <WorkbenchTabsBrowserBookmarkBar
      v-if="showBookmarkBar"
      :bookmarks="bookmarks"
      @navigate="handleNavigate($event)"
      @remove="removeBookmarkUrl"
    />

    <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <!-- Coordinate placeholder for the native CEF child view. -->
        <div
          ref="hostEl"
          class="absolute inset-0 h-full w-full"
          aria-hidden="true"
        />
        <Empty
          v-if="!hasPage"
          class="pointer-events-none absolute inset-4 z-10 flex min-h-0 border border-dashed border-border/60"
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
      <WorkbenchTabsBrowserConsolePanel
        v-if="consoleOpen"
        :lines="lines"
        @clear="clearConsole"
      />
    </div>
  </div>
</template>
