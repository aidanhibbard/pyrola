<script setup lang="ts">
import { Comark } from '@comark/vue'
import studioBlocks from '@/components/studio/studio-blocks'

defineProps<{
  markdown: string
  data?: Record<string, unknown>
}>()
</script>

<template>
  <div
    class="studio-renderer space-y-10 text-[15px] leading-7 text-muted-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_li]:text-muted-foreground [&_p]:text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5"
  >
    <Suspense>
      <Comark :markdown="markdown" :components="studioBlocks" :data="data ?? {}" />
      <template #fallback>
        <p class="text-sm text-muted-foreground">Rendering studio artifact…</p>
      </template>
    </Suspense>
  </div>
</template>
