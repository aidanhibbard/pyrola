<script setup lang="ts">
import type { FileUIPart } from 'ai'
import type { QueuedChatMessage } from '@/types/chat/queued-chat-message'
import { ArrowUpIcon, PencilIcon, Trash2Icon } from '@lucide/vue'
import {
  Queue,
  QueueItem,
  QueueItemAction,
  QueueItemActions,
  QueueItemAttachment,
  QueueItemContent,
  QueueItemFile,
  QueueItemImage,
  QueueItemIndicator,
  QueueSection,
  QueueSectionContent,
  QueueSectionLabel,
  QueueSectionTrigger,
} from '@/components/ai-elements/queue'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

defineProps<{
  items: QueuedChatMessage[]
}>()

const emit = defineEmits<{
  edit: [id: string]
  force: [id: string]
  remove: [id: string]
}>()

const isImage = (file: FileUIPart): boolean =>
  file.mediaType === 'image' || file.mediaType.startsWith('image/')

const fileLabel = (file: FileUIPart): string => file.filename ?? 'File'

const handleEdit = (id: string): void => {
  emit('edit', id)
}

const handleForce = (id: string): void => {
  emit('force', id)
}

const handleRemove = (id: string): void => {
  emit('remove', id)
}
</script>

<template>
  <Queue v-if="items.length > 0">
    <QueueSection :default-open="true">
      <QueueSectionTrigger>
        <QueueSectionLabel
          :count="items.length"
          label="queued"
        />
      </QueueSectionTrigger>
      <QueueSectionContent>
        <ul class="flex flex-col gap-1">
          <QueueItem
            v-for="item in items"
            :key="item.id"
          >
            <div class="flex w-full items-start gap-2">
              <QueueItemIndicator class="mt-1 shrink-0" />
              <QueueItemContent
                class="line-clamp-3 min-w-0 flex-1 whitespace-normal break-words"
              >
                {{ item.text || (item.files.length > 0 ? 'See attached image(s).' : '') }}
              </QueueItemContent>
              <QueueItemActions class="ml-auto shrink-0 self-start">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <QueueItemAction
                      aria-label="Edit"
                      @click="handleEdit(item.id)"
                    >
                      <PencilIcon class="size-3.5" />
                    </QueueItemAction>
                  </TooltipTrigger>
                  <TooltipContent>Edit</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <QueueItemAction
                      aria-label="Send now (stops running work)"
                      @click="handleForce(item.id)"
                    >
                      <ArrowUpIcon class="size-3.5" />
                    </QueueItemAction>
                  </TooltipTrigger>
                  <TooltipContent>Send now (stops running work)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <QueueItemAction
                      aria-label="Remove"
                      @click="handleRemove(item.id)"
                    >
                      <Trash2Icon class="size-3.5" />
                    </QueueItemAction>
                  </TooltipTrigger>
                  <TooltipContent>Remove</TooltipContent>
                </Tooltip>
              </QueueItemActions>
            </div>
            <QueueItemAttachment
              v-if="item.files.length > 0"
              class="pl-6"
            >
              <template
                v-for="file in item.files"
                :key="file.url"
              >
                <QueueItemImage
                  v-if="isImage(file)"
                  :src="file.url"
                />
                <QueueItemFile v-else>{{ fileLabel(file) }}</QueueItemFile>
              </template>
            </QueueItemAttachment>
          </QueueItem>
        </ul>
      </QueueSectionContent>
    </QueueSection>
  </Queue>
</template>
