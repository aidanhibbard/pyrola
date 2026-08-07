<script setup lang="ts">
import { computed, ref } from 'vue'
import { PencilIcon } from '@lucide/vue'
import type { UIMessage } from 'ai'
import AiElementsMessageMessage from '@/components/ai-elements/message/Message.vue'
import AiElementsMessageMessageAction from '@/components/ai-elements/message/MessageAction.vue'
import AiElementsMessageMessageActions from '@/components/ai-elements/message/MessageActions.vue'
import AiElementsMessageMessageContent from '@/components/ai-elements/message/MessageContent.vue'
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
import type { UserMessageMetadata } from '@/types/chat/user-message-metadata'
import formatModelLabelFromRef from '@/utils/format-model-label-from-ref'
import formatRelativeTime from '@/utils/format-relative-time'

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

const metadata = computed((): UserMessageMetadata => {
  const value = props.message.metadata
  if (!value || typeof value !== 'object') {
    return {}
  }
  const record = value as Record<string, unknown>
  return {
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
    model: typeof record.model === 'string' ? record.model : undefined,
  }
})

const modelLabel = computed(() => {
  const fromMeta = formatModelLabelFromRef(metadata.value.model)
  if (fromMeta) {
    return fromMeta
  }
  return formatModelLabelFromRef(chatStore.meta.value?.model)
})

const relativeTime = computed(() => {
  if (!metadata.value.createdAt) {
    return ''
  }
  return formatRelativeTime(metadata.value.createdAt)
})

const isEditing = computed(
  () => chatStore.editingMessageId.value === props.message.id,
)

const handleEditClick = (): void => {
  if (!props.editable || isEditing.value) {
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
  <div class="flex w-full min-w-0 flex-col items-end gap-1.5">
    <AiElementsMessageMessage
      from="user"
      class="group/user-message min-w-0 max-w-[80%]"
    >
      <AiElementsMessageMessageContent
        :class="[
          'max-w-full break-words whitespace-pre-wrap',
          isEditing ? 'ring-1 ring-inset ring-primary/40' : '',
          editable && !isEditing
            ? 'cursor-pointer hover:ring-1 hover:ring-inset hover:ring-border/60'
            : '',
        ]"
        @click="handleEditClick"
      >
        {{ text }}
      </AiElementsMessageMessageContent>
    </AiElementsMessageMessage>

    <AiElementsMessageMessageActions
      class="justify-end gap-2 text-xs text-muted-foreground"
    >
      <AiElementsMessageMessageAction
        v-if="editable"
        tooltip="Edit message"
        label="Edit message"
        class="size-7"
        :disabled="isEditing"
        @click="handleEditClick"
      >
        <PencilIcon class="size-3.5" />
      </AiElementsMessageMessageAction>
      <span v-if="relativeTime || modelLabel" class="truncate max-w-64">
        <template v-if="relativeTime && modelLabel">
          {{ relativeTime }} on {{ modelLabel }}
        </template>
        <template v-else-if="relativeTime">
          {{ relativeTime }}
        </template>
        <template v-else>
          {{ modelLabel }}
        </template>
      </span>
    </AiElementsMessageMessageActions>
  </div>

  <AlertDialog
    :open="confirmOpen"
    @update:open="handleConfirmOpenChange"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Edit this message?</AlertDialogTitle>
        <AlertDialogDescription>
          Editing this message will discard the conversation after it.
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
