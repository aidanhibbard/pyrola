<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import {
  Bot,
  FileCode,
  Folder,
  MessageSquare,
  Pin,
  Settings,
  Terminal,
} from '@lucide/vue'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/shadcn/ui/command'
import { Tabs, TabsList, TabsTrigger } from '@/components/shadcn/ui/tabs'
import useCommandPalette from '@/composables/use-command-palette'
import {
  COMMAND_PALETTE_TABS,
  getCommandPaletteTab,
  type CommandPaletteItem,
  type CommandPaletteTab,
} from '@/types/navigation/command-palette-item'
import useFleetRegistry from '@/composables/use-fleet-registry'
import useWorkbenchStore from '@/composables/use-workbench-store'

const router = useRouter()
const fleet = useFleetRegistry()
const workbench = useWorkbenchStore()
const { open, items, closePalette } = useCommandPalette()

const activeTab = ref<CommandPaletteTab>('All')

const filteredItems = computed(() => {
  if (activeTab.value === 'All') {
    return items.value
  }

  return items.value.filter(
    (item) => getCommandPaletteTab(item) === activeTab.value,
  )
})

const itemIcon = (item: CommandPaletteItem) => {
  if (item.action === 'new-agent') {
    return Bot
  }
  if (item.action === 'open-settings' || item.settingsSection) {
    return Settings
  }
  if (item.action === 'open-terminal') {
    return Terminal
  }
  if (item.action === 'open-editor') {
    return FileCode
  }
  if (item.group === 'Projects') {
    return Folder
  }
  if (item.group === 'Pinned') {
    return Pin
  }
  return MessageSquare
}

const handleSelect = async (item: CommandPaletteItem): Promise<void> => {
  closePalette()

  try {
    if (item.action === 'new-agent') {
      await router.push('/')
      return
    }

    if (item.action === 'open-settings') {
      await router.push('/settings')
      return
    }

    if (item.action === 'open-terminal') {
      const projectId = fleet.activeProjectId.value
      if (!projectId) {
        toast.error('No active project', {
          description: 'Select a project before opening the terminal.',
        })
        return
      }
      await workbench.openTerminal(projectId)
      return
    }

    if (item.action === 'open-editor') {
      const projectId = fleet.activeProjectId.value
      if (!projectId) {
        toast.error('No active project', {
          description: 'Select a project before opening the editor.',
        })
        return
      }
      await workbench.openEditor(projectId, 'README.md')
      return
    }

    if (item.settingsSection) {
      await router.push({
        path: '/settings',
        query: { tab: 'personal', section: item.settingsSection },
      })
      return
    }

    if (item.chatId && item.projectSlug) {
      await router.push(`/project/${item.projectSlug}/chat/${item.chatId}`)
      return
    }

    if (item.projectSlug) {
      const project = fleet.projects.value.find(
        (entry) => entry.slug === item.projectSlug,
      )
      if (!project) {
        toast.error('Project not found')
        return
      }
      await fleet.setActiveProject(project.id)
      await router.push('/')
    }
  } catch (error) {
    toast.error('Action failed', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
</script>

<template>
  <CommandDialog v-model:open="open">
    <Tabs
      :model-value="activeTab"
      class="px-2 pt-2"
      @update:model-value="(value) => { activeTab = value as CommandPaletteTab }"
    >
      <TabsList class="grid w-full grid-cols-5">
        <TabsTrigger
          v-for="tab in COMMAND_PALETTE_TABS"
          :key="tab"
          :value="tab"
        >
          {{ tab }}
        </TabsTrigger>
      </TabsList>
    </Tabs>
    <CommandInput placeholder="Search projects, chats, and actions…" />
    <CommandList>
      <CommandEmpty>No results found.</CommandEmpty>
      <CommandGroup>
        <CommandItem
          v-for="item in filteredItems"
          :key="item.id"
          :value="item.subtitle ? `${item.label} ${item.subtitle}` : item.label"
          @select="handleSelect(item)"
        >
          <component :is="itemIcon(item)" />
          <span class="truncate">{{ item.label }}</span>
          <span
            v-if="item.subtitle"
            class="ml-auto truncate text-xs text-muted-foreground"
          >
            {{ item.subtitle }}
          </span>
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </CommandDialog>
</template>
