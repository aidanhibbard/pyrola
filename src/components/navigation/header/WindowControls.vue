<script setup lang="ts">
import { X, Minus, Plus } from "@lucide/vue"
import { getCurrentWindow } from "@tauri-apps/api/window"

const appWindow = getCurrentWindow()

function minimize() {
  appWindow.minimize()
}

function toggleMaximize() {
  appWindow.toggleMaximize()
}

function close() {
  appWindow.close()
}
</script>

<template>
  <!-- Custom macOS-style traffic lights (same on all platforms) -->
  <div
    class="group/controls flex items-center gap-2 pl-3 shrink-0"
    data-tauri-drag-region="false"
  >
    <button
      type="button"
      title="Close"
      aria-label="Close"
      class="flex size-3 items-center justify-center rounded-full bg-[#ff5f57] transition-opacity hover:opacity-90"
      @click="close"
    >
      <X class="size-2 text-black/60 opacity-0 group-hover/controls:opacity-100" />
    </button>
    <button
      type="button"
      title="Minimize"
      aria-label="Minimize"
      class="flex size-3 items-center justify-center rounded-full bg-[#febc2e] transition-opacity hover:opacity-90"
      @click="minimize"
    >
      <Minus class="size-2 text-black/60 opacity-0 group-hover/controls:opacity-100" />
    </button>
    <button
      type="button"
      title="Maximize"
      aria-label="Maximize"
      class="flex size-3 items-center justify-center rounded-full bg-[#28c840] transition-opacity hover:opacity-90"
      @click="toggleMaximize"
    >
      <Plus class="size-2 text-black/60 opacity-0 group-hover/controls:opacity-100" />
    </button>
  </div>
</template>
