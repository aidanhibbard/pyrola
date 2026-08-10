<script setup lang="ts">
import { X } from '@lucide/vue'
import type { BrowserBookmark } from '@/services/browser/bookmarks'
import { faviconForUrl } from '@/utils/browser-tab-url'

defineProps<{
  bookmarks: BrowserBookmark[]
}>()

const emit = defineEmits<{
  navigate: [url: string]
  remove: [url: string]
}>()

const labelFor = (bookmark: BrowserBookmark): string => {
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
  <div class="flex gap-1 overflow-x-auto border-b border-border/50 px-2 py-1">
    <template v-if="bookmarks.length > 0">
      <button
        v-for="bookmark in bookmarks"
        :key="bookmark.url"
        type="button"
        class="group flex max-w-[180px] shrink-0 items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1 text-xs text-foreground hover:bg-muted"
        @click="emit('navigate', bookmark.url)"
      >
        <img
          v-if="faviconForUrl(bookmark.url)"
          :src="faviconForUrl(bookmark.url) ?? undefined"
          alt=""
          class="h-3.5 w-3.5 shrink-0"
        >
        <span class="truncate">
          {{ labelFor(bookmark) }}
        </span>
        <span
          class="rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-accent/50"
          @click.stop="emit('remove', bookmark.url)"
        >
          <X class="h-3 w-3" />
        </span>
      </button>
    </template>
    <span
      v-else
      class="px-1 text-xs text-muted-foreground"
    >
      No bookmarks
    </span>
  </div>
</template>
