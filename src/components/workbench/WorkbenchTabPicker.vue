<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ChartBar,
  FileCode,
  FileText,
  GitBranch,
  Globe,
  Terminal,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/shadcn/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/shadcn/ui/dropdown-menu'
import useChatStore from '@/composables/use-chat-store'
import useFleetRegistry from '@/composables/use-fleet-registry'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import { refreshFleetSidebar } from '@/composables/use-fleet-sidebar'
import useWorkbenchStore from '@/composables/use-workbench-store'
import type { PyrolaChatMode } from '@/types/pyrola/pyrola-settings'

const props = defineProps<{
  triggerClass?: string
}>()

const router = useRouter()
const fleet = useFleetRegistry()
const chatStore = useChatStore()
const config = usePyrolaConfig()
const workbench = useWorkbenchStore()
const open = ref(false)
const startingChat = ref(false)

const items = [
  { id: 'editor', label: 'Editor', icon: FileCode },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'browser', label: 'Browser', icon: Globe },
  { id: 'changes', label: 'Changes', icon: GitBranch },
  { id: 'plan', label: 'Plan', icon: FileText },
  { id: 'studio', label: 'Studio', icon: ChartBar },
] as const

const activeProjectId = computed(() => fleet.activeProjectId.value)

const startModeChat = async (projectId: string, mode: PyrolaChatMode): Promise<void> => {
  const project = fleet.projects.value.find((item) => item.id === projectId)
  if (!project) {
    toast.error('Project not found')
    return
  }

  startingChat.value = true
  try {
    await fleet.setActiveProject(project.id)
    const chat = await chatStore.createNewChat({
      projectSlug: project.slug,
      projectRoot: project.rootPath,
      mode,
      model: config.effectiveSettings.value['agent.defaultModel'] ?? '',
    })
    await refreshFleetSidebar()
    await router.push(`/project/${project.slug}/chat/${chat.id}`)
  } catch (error) {
    toast.error('Could not start chat', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    startingChat.value = false
  }
}

const handleOpen = async (type: (typeof items)[number]['id']): Promise<void> => {
  const projectId = activeProjectId.value
  if (!projectId || startingChat.value) {
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
    case 'plan':
      await startModeChat(projectId, 'plan')
      break
    case 'studio':
      await startModeChat(projectId, 'studio')
      break
  }

  open.value = false
}
</script>

<template>
  <DropdownMenu v-model:open="open">
    <DropdownMenuTrigger as-child>
      <slot>
        <Button variant="ghost" size="icon" :class="props.triggerClass" aria-label="New tab">
          <span class="text-lg leading-none">+</span>
        </Button>
      </slot>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="w-40">
      <DropdownMenuItem
        v-for="item in items"
        :key="item.id"
        :disabled="!activeProjectId || startingChat"
        @click="handleOpen(item.id)"
      >
        <component :is="item.icon" class="mr-2 h-4 w-4" />
        {{ item.label }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
