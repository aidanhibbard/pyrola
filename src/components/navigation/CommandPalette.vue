<script setup lang="ts">
import { computed } from 'vue'
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
import useCommandPalette from '@/composables/use-command-palette'
import type {
  CommandPaletteGroup,
  CommandPaletteItem,
} from '@/types/navigation/command-palette-item'
import useFleetRegistry from '@/composables/use-fleet-registry'
import useWorkbenchStore from '@/composables/use-workbench-store'

const GROUP_ORDER: CommandPaletteGroup[] = [
  'Actions',
  'Projects',
  'Chats',
  'Pinned',
  'Settings',
]

const router = useRouter()
const fleet = useFleetRegistry()
const workbench = useWorkbenchStore()
const { open, items, closePalette } = useCommandPalette()

const groupedItems = computed(() => {
  const groups = new Map<CommandPaletteGroup, CommandPaletteItem[]>()

  for (const item of items.value) {
    const list = groups.get(item.group) ?? []
    list.push(item)
    groups.set(item.group, list)
  }

  return GROUP_ORDER.filter((name) => groups.has(name)).map((name) => ({
    name,
    items: groups.get(name)!,
  }))
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
    <CommandInput placeholder="Search projects, chats, and actions…" />
    <CommandList>
      <CommandEmpty>No results found.</CommandEmpty>
      <CommandGroup
        v-for="group in groupedItems"
        :key="group.name"
        :heading="group.name"
      >
        <CommandItem
          v-for="item in group.items"
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
