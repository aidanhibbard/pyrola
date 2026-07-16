<script lang="ts" setup>
import type { ToasterProps } from "vue-sonner"
import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon, XIcon } from "@lucide/vue"
import { reactiveOmit, useColorMode } from "@vueuse/core"
import { computed } from "vue"
import { Toaster as Sonner } from "vue-sonner"
import { cn } from "@/lib/utils"

const props = defineProps<ToasterProps>()
const delegatedProps = reactiveOmit(props, "toastOptions", "theme")

const mode = useColorMode()
const sonnerTheme = computed(() =>
  mode.value === "auto" ? "system" : mode.value,
)
</script>

<template>
  <Sonner
    :theme="sonnerTheme"
    class="toaster group pointer-events-auto"
    :toast-options="{
      classes: {
        toast:
          'group toast group-[.toaster]:border-border group-[.toaster]:bg-zinc-50 group-[.toaster]:text-foreground group-[.toaster]:shadow-lg group-[.toaster]:backdrop-blur-none dark:group-[.toaster]:bg-zinc-900',
        description: 'group-[.toast]:text-muted-foreground',
        actionButton:
          'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
        cancelButton:
          'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
      },
    }"
    v-bind="delegatedProps"
    :class="cn(props.class)"
  >
    <template #success-icon>
      <CircleCheckIcon class="size-4" />
    </template>
    <template #info-icon>
      <InfoIcon class="size-4" />
    </template>
    <template #warning-icon>
      <TriangleAlertIcon class="size-4" />
    </template>
    <template #error-icon>
      <OctagonXIcon class="size-4" />
    </template>
    <template #loading-icon>
      <div>
        <Loader2Icon class="size-4 animate-spin" />
      </div>
    </template>
    <template #close-icon>
      <XIcon class="size-4" />
    </template>
  </Sonner>
</template>
