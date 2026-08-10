<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import DOMPurify from 'dompurify'
import mermaid from 'mermaid'

const props = defineProps<{
  code?: string
}>()

const container = ref<HTMLElement | null>(null)
const rendered = ref('')

const sanitizeMermaidSvg = (svg: string): string => {
  return DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } })
}

const removeMermaidTempNode = (id: string): void => {
  document.getElementById(`d${id}`)?.remove()
  document.getElementById(id)?.remove()
}

const renderDiagram = async (): Promise<void> => {
  const source = props.code?.trim() ?? ''
  if (!source || !container.value) {
    rendered.value = ''
    return
  }

  const id = `studio-mermaid-${Math.random().toString(36).slice(2)}`
  try {
    const { svg } = await mermaid.render(id, source)
    rendered.value = sanitizeMermaidSvg(svg)
  } catch {
    removeMermaidTempNode(id)
    rendered.value = ''
  }
}

onMounted(() => {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'neutral',
    securityLevel: 'strict',
    suppressErrorRendering: true,
  })
  renderDiagram().catch(() => {
    rendered.value = ''
  })
})

watch(() => props.code, () => {
  renderDiagram().catch(() => {
    rendered.value = ''
  })
})
</script>

<template>
  <div v-if="code" ref="container" class="overflow-x-auto rounded-lg border border-border/50 p-4">
    <div v-if="rendered" v-html="rendered" />
    <pre v-else class="text-xs text-muted-foreground">{{ code }}</pre>
  </div>
  <div v-else-if="$slots.default" class="overflow-x-auto rounded-lg border border-border/50 p-4">
    <slot />
  </div>
</template>
