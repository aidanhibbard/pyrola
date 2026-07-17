<script setup lang="ts">
defineProps<{
  title?: string
  subtitle?: string
  meta?: string
}>()
</script>

<template>
  <header v-if="title || subtitle || meta" class="space-y-2">
    <h1 v-if="title" class="text-[28px] font-semibold tracking-tight leading-tight">{{ title }}</h1>
    <p v-if="subtitle" class="text-base leading-7 text-muted-foreground">{{ subtitle }}</p>
    <p v-if="meta" class="text-xs text-muted-foreground">{{ meta }}</p>
    <div v-if="$slots.default" class="pt-2 text-[15px] leading-7 text-muted-foreground">
      <slot />
    </div>
  </header>
</template>
