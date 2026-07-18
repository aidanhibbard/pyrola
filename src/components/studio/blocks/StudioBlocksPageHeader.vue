<script setup lang="ts">
defineProps<{
  title?: string
  subtitle?: string
  meta?: string
}>()
</script>

<template>
  <header v-if="title || subtitle || meta" class="space-y-2">
    <h1 v-if="title" class="text-2xl font-semibold tracking-tight leading-tight text-foreground">{{ title }}</h1>
    <p v-if="subtitle" class="text-sm leading-6 text-muted-foreground">{{ subtitle }}</p>
    <p v-if="meta" class="text-xs text-muted-foreground">{{ meta }}</p>
    <div v-if="$slots.default" class="pt-2 text-sm leading-6 text-muted-foreground">
      <slot />
    </div>
  </header>
</template>
