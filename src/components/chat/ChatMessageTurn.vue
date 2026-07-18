<script setup lang="ts">
import { computed, ref } from 'vue'
import { PencilIcon } from '@lucide/vue'
import type { UIMessage } from 'ai'
import { Button } from '@/components/shadcn/ui/button'
import {
  Bubble,
  BubbleContent,
} from '@/components/shadcn/ui/bubble'
import {
  Message,
  MessageContent,
} from '@/components/shadcn/ui/message'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/shadcn/ui/tooltip'
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
import useChatStore from '@/composables/use-chat-store'

const props = defineProps<{
  message: UIMessage
  editable?: boolean
}>()

const chatStore = useChatStore()
const confirmOpen = ref(false)

const text = computed(() =>
  props.message.parts
    .filter((part) => part.type === 'text')
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join(''),
)

const isEditing = computed(
  () => chatStore.editingMessageId.value === props.message.id,
)

const handleEditClick = (): void => {
  if (!props.editable) {
    return
  }
  if (chatStore.hasTimelineContentAfterMessage(props.message.id)) {
    confirmOpen.value = true
    return
  }
  chatStore.beginEditMessage(props.message.id)
}

const handleConfirmEdit = (): void => {
  confirmOpen.value = false
  chatStore.beginEditMessage(props.message.id)
}

const handleConfirmOpenChange = (open: boolean): void => {
  confirmOpen.value = open
}
</script>

<template>
  <Message
    align="end"
    class="group/user-message min-w-0 max-w-full"
  >
    <MessageContent class="max-w-[85%]">
      <div class="flex items-start gap-1">
        <Tooltip v-if="editable">
          <TooltipTrigger as-child>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="mt-1 size-7 shrink-0 opacity-0 transition-opacity group-hover/user-message:opacity-100"
              :class="isEditing ? 'opacity-100' : ''"
              :disabled="isEditing"
              @click="handleEditClick"
            >
              <PencilIcon class="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit message</TooltipContent>
        </Tooltip>
        <Bubble
          variant="default"
          :class="isEditing ? 'ring-1 ring-primary/40' : ''"
        >
          <BubbleContent class="break-words text-sm whitespace-pre-wrap">
            {{ text }}
          </BubbleContent>
        </Bubble>
      </div>
    </MessageContent>
  </Message>

  <AlertDialog
    :open="confirmOpen"
    @update:open="handleConfirmOpenChange"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Edit this message?</AlertDialogTitle>
        <AlertDialogDescription>
          Editing this message will discard the conversation after it. Continue?
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction @click="handleConfirmEdit">
          Continue
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
