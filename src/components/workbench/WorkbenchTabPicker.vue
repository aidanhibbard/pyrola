<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  FileCode,
  GitBranch,
  Globe,
  Terminal,
} from '@lucide/vue'
import { Button } from '@/components/shadcn/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/shadcn/ui/dropdown-menu'
import useFleetRegistry from '@/composables/use-fleet-registry'
import useWorkbenchStore from '@/composables/use-workbench-store'

const props = withDefaults(
  defineProps<{
    triggerClass?: string
    tooltip?: string
  }>(),
  {
    tooltip: 'New tab',
  },
)

const fleet = useFleetRegistry()
const workbench = useWorkbenchStore()
const open = ref(false)

const items = [
  { id: 'editor', label: 'Editor', icon: FileCode },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'browser', label: 'Browser', icon: Globe },
  { id: 'changes', label: 'Changes', icon: GitBranch },
] as const

const activeProjectId = computed(() => fleet.activeProjectId.value)

const handleOpen = (type: (typeof items)[number]['id']): void => {
  const projectId = activeProjectId.value
  if (!projectId) {
    return
  }

  switch (type) {
    case 'editor':
      workbench.openEditor(projectId, 'README.md')
      break
    case 'terminal':
      workbench.openTerminal(projectId)
      break
    case 'browser':
      workbench.openBrowser(projectId, 'https://')
      break
    case 'changes':
      workbench.openChanges(projectId)
      break
  }

  open.value = false
}
</script>

<template>
  <DropdownMenu v-model:open="open">
    <DropdownMenuTrigger as-child>
      <slot>
        <Button
          variant="ghost"
          size="icon"
          :class="props.triggerClass"
          :aria-label="props.tooltip"
          :title="props.tooltip"
        >
          <span class="text-lg leading-none">+</span>
        </Button>
      </slot>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="w-40">
      <DropdownMenuItem
        v-for="item in items"
        :key="item.id"
        :disabled="!activeProjectId"
        @click="handleOpen(item.id)"
      >
        <component :is="item.icon" class="mr-2 h-4 w-4" />
        {{ item.label }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
