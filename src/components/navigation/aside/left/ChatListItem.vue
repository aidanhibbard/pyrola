<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { GitFork, Pencil, Trash2 } from '@lucide/vue'
import type { FleetSidebarChat } from '@/types/fleet/fleet-sidebar-chat'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/shadcn/ui/alert-dialog'
import { Button } from '@/components/shadcn/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/shadcn/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/ui/dialog'
import { Input } from '@/components/shadcn/ui/input'
import { SidebarMenuSubButton } from '@/components/shadcn/ui/sidebar'
import { refreshFleetSidebar } from '@/composables/use-fleet-sidebar'
import {
  deleteChat,
  forkChat,
  updateChatMeta,
} from '@/services/pyrola/pyrola-tauri'

const props = defineProps<{
  chat: FleetSidebarChat
  projectSlug: string
}>()

const route = useRoute()
const router = useRouter()

const renameOpen = ref(false)
const deleteOpen = ref(false)
const renameTitle = ref(props.chat.title)
const savingRename = ref(false)
const deleting = ref(false)
const forking = ref(false)

const openChat = async (): Promise<void> => {
  try {
    await router.push(`/project/${props.projectSlug}/chat/${props.chat.id}`)
  } catch (error) {
    toast.error('Navigation failed', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const openRenameDialog = (): void => {
  renameTitle.value = props.chat.title
  renameOpen.value = true
}

const handleRename = async (): Promise<void> => {
  const title = renameTitle.value.trim()
  if (!title || title === props.chat.title) {
    renameOpen.value = false
    return
  }

  savingRename.value = true
  try {
    await updateChatMeta(props.projectSlug, props.chat.id, { title })
    await refreshFleetSidebar()
    renameOpen.value = false
    toast.success('Chat renamed')
  } catch (error) {
    toast.error('Could not rename chat', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    savingRename.value = false
  }
}

const handleFork = async (): Promise<void> => {
  if (forking.value) {
    return
  }

  forking.value = true
  try {
    const forked = await forkChat(props.projectSlug, props.chat.id)
    await refreshFleetSidebar()
    await router.push(`/project/${props.projectSlug}/chat/${forked.id}`)
    toast.success('Chat forked')
  } catch (error) {
    toast.error('Could not fork chat', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    forking.value = false
  }
}

const handleDelete = async (): Promise<void> => {
  if (deleting.value) {
    return
  }

  deleting.value = true
  try {
    await deleteChat(props.projectSlug, props.chat.id)
    await refreshFleetSidebar()
    deleteOpen.value = false

    if (
      route.params.slug === props.projectSlug &&
      route.params.chatId === props.chat.id
    ) {
      await router.push('/')
    }

    toast.success('Chat deleted')
  } catch (error) {
    toast.error('Could not delete chat', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    deleting.value = false
  }
}

watch(
  () => props.chat.title,
  (title) => {
    renameTitle.value = title
  },
)
</script>

<template>
  <ContextMenu>
    <ContextMenuTrigger as-child>
      <SidebarMenuSubButton
        as="button"
        type="button"
        class="h-8 w-full min-w-0 px-2"
        @click="openChat"
      >
        <span class="block min-w-0 flex-1 truncate text-left text-sm">
          {{ chat.title }}
        </span>
      </SidebarMenuSubButton>
    </ContextMenuTrigger>
    <ContextMenuContent class="w-48">
      <ContextMenuItem :disabled="savingRename" @select="openRenameDialog">
        <Pencil />
        Rename
      </ContextMenuItem>
      <ContextMenuItem :disabled="forking" @select="handleFork">
        <GitFork />
        Fork
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" @select="deleteOpen = true">
        <Trash2 />
        Delete
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>

  <Dialog v-model:open="renameOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Rename chat</DialogTitle>
        <DialogDescription>Enter a new title for this chat.</DialogDescription>
      </DialogHeader>
      <Input
        v-model="renameTitle"
        autocomplete="off"
        @keydown.enter.prevent="handleRename"
      />
      <DialogFooter>
        <Button variant="outline" @click="renameOpen = false">Cancel</Button>
        <Button :disabled="savingRename || !renameTitle.trim()" @click="handleRename">
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <AlertDialog v-model:open="deleteOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete chat?</AlertDialogTitle>
        <AlertDialogDescription>
          This permanently deletes "{{ chat.title }}" and its message history.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          class="bg-destructive text-white hover:bg-destructive/90"
          :disabled="deleting"
          @click="handleDelete"
        >
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
