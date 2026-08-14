<script setup lang="ts">
import { Check, ChevronDown, Plus, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { BrowserTab } from '@/types/browser/browser-tab'

const props = defineProps<{
  pages: BrowserTab[]
  activeSessionId: string | null
  workspaceId: string
}>()

const emit = defineEmits<{
  select: [sessionId: string]
  close: [sessionId: string]
  add: []
}>()

const {
  chats,
  pendingMove,
  preferredChatIdFor,
  preferredLabelFor,
  lockOwnerTitleFor,
  assignToChat,
  confirmPendingMove,
  dismissPendingMove,
  refreshAssignChats,
} = useBrowserPageAssign(props.workspaceId)

const confirmOpen = computed({
  get: () => pendingMove.value !== null,
  set: (open: boolean) => {
    if (!open) {
      dismissPendingMove()
    }
  },
})

const pageLabel = (page: BrowserTab): string => {
  if (page.title && page.title.trim()) {
    return page.title
  }
  try {
    const host = new URL(page.url).hostname
    if (host) {
      return host
    }
  } catch {
    // Fall through.
  }
  if (page.url && page.url !== 'about:blank') {
    return page.url
  }
  return 'New page'
}
</script>

<template>
  <div
    class="flex items-center gap-1 overflow-x-auto border-b border-border/50 bg-background px-2 py-1"
  >
    <div
      v-for="page in pages"
      :key="page.viewId"
      class="flex h-7 max-w-52 shrink-0 items-center rounded-md"
      :class="
        page.viewId === activeSessionId
          ? 'bg-accent text-accent-foreground'
          : ''
      "
    >
      <Button
        variant="ghost"
        size="sm"
        class="h-7 min-w-0 flex-1 gap-1 px-2 text-xs"
        @click="emit('select', page.viewId)"
      >
        <span class="truncate">{{ pageLabel(page) }}</span>
        <span
          v-if="preferredLabelFor(page.viewId)"
          class="max-w-16 truncate text-[10px] font-normal text-muted-foreground"
        >
          {{ preferredLabelFor(page.viewId) }}
        </span>
      </Button>
      <DropdownMenu @update:open="refreshAssignChats">
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="h-7 w-6 shrink-0"
            type="button"
            aria-label="Assign to chat"
            @click.stop
          >
            <ChevronDown class="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="min-w-44">
          <DropdownMenuLabel>Assign to chat</DropdownMenuLabel>
          <p
            v-if="lockOwnerTitleFor(page.viewId)"
            class="px-2 pb-1 text-xs text-muted-foreground"
          >
            In use by {{ lockOwnerTitleFor(page.viewId) }}
          </p>
          <DropdownMenuSeparator />
          <DropdownMenuItem v-if="chats.length === 0" disabled>
            No chats
          </DropdownMenuItem>
          <DropdownMenuItem
            v-for="chat in chats"
            :key="chat.id"
            :disabled="preferredChatIdFor(page.viewId) === chat.id"
            @click="assignToChat(chat.id, page.viewId)"
          >
            <span class="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
              <Check
                v-if="preferredChatIdFor(page.viewId) === chat.id"
                class="h-3.5 w-3.5"
              />
            </span>
            <span class="truncate">{{ chat.title || chat.id }}</span>
            <span
              v-if="preferredChatIdFor(page.viewId) === chat.id"
              class="ml-auto text-xs text-muted-foreground"
            >
              Assigned
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-6 shrink-0"
        type="button"
        aria-label="Close page"
        @click.stop="emit('close', page.viewId)"
      >
        <X class="h-3 w-3" />
      </Button>
    </div>
    <Button
      variant="ghost"
      size="icon"
      class="h-7 w-7 shrink-0"
      type="button"
      aria-label="New page"
      @click="emit('add')"
    >
      <Plus class="h-3.5 w-3.5" />
    </Button>
  </div>

  <AlertDialog v-model:open="confirmOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Move this page?</AlertDialogTitle>
        <AlertDialogDescription>
          {{ pendingMove?.ownerTitle }} is using this page.
          Move it to {{ pendingMove?.targetTitle }}?
          {{ pendingMove?.ownerTitle }} will lose the lock.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction @click="confirmPendingMove">
          Move page
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
