<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { FileCodeIcon, FileTextIcon, SparklesIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import type { ChatArtifact } from '@/types/chat/chat-artifact'
import { Button } from '@/components/shadcn/ui/button'
import useFleetRegistry from '@/composables/use-fleet-registry'
import useWorkbenchStore from '@/composables/use-workbench-store'

const props = defineProps<{
  artifact: ChatArtifact
}>()

const route = useRoute()
const fleet = useFleetRegistry()
const workbench = useWorkbenchStore()

const projectId = computed(() => {
  const slug = String(route.params.slug ?? '')
  const project = fleet.projects.value.find((item) => item.slug === slug)
  return project?.id ?? fleet.activeProjectId.value
})

const displayLabel = computed(() => {
  if (props.artifact.label) {
    return props.artifact.label
  }
  if (props.artifact.kind === 'studio') {
    const match = props.artifact.path.match(/^\.pyrola\/studio\/([^/]+)\//)
    if (match?.[1]) {
      return match[1]
    }
  }
  if (props.artifact.kind === 'plan') {
    const match = props.artifact.path.match(/^\.pyrola\/plans\/([^/]+)\//)
    if (match?.[1]) {
      return match[1]
    }
  }
  const segments = props.artifact.path.split('/')
  return segments[segments.length - 1] ?? props.artifact.path
})

const icon = computed(() => {
  if (props.artifact.kind === 'plan') {
    return FileTextIcon
  }
  if (props.artifact.kind === 'studio') {
    return SparklesIcon
  }
  return FileCodeIcon
})

const handleOpen = async (): Promise<void> => {
  const id = projectId.value
  if (!id) {
    toast.error('Project not found', {
      description: 'Could not resolve the active project for this chat.',
    })
    return
  }

  try {
    if (props.artifact.kind === 'plan') {
      const planId =
        props.artifact.path.match(/^\.pyrola\/plans\/([^/]+)\//)?.[1] ??
        displayLabel.value
      workbench.openPlan(id, planId, props.artifact.path, props.artifact.label)
      return
    }

    if (props.artifact.kind === 'studio') {
      const slug =
        props.artifact.path.match(/^\.pyrola\/studio\/([^/]+)\//)?.[1] ??
        displayLabel.value
      workbench.openStudio(id, slug, props.artifact.path, props.artifact.label)
      return
    }

    await workbench.openEditor(id, props.artifact.path)
  } catch (error) {
    toast.error('Failed to open artifact', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
</script>

<template>
  <Button
    type="button"
    variant="link"
    size="xs"
    class="h-auto max-w-[12rem] shrink-0 px-0 py-0 text-xs font-normal"
    @click="handleOpen"
  >
    <component :is="icon" class="size-3 shrink-0" />
    <span class="truncate">{{ displayLabel }}</span>
  </Button>
</template>
