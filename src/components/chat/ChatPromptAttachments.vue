<script setup lang="ts">
import { computed } from 'vue'
import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from '@/components/ai-elements/attachments'
import type { AttachmentData } from '@/components/ai-elements/attachments'
import { usePromptInput } from '@/components/ai-elements/prompt-input/context'
import useChatPromptDraftMedia from '@/composables/use-chat-prompt-draft-media'
import type { DraftBrowserElementMedia } from '@/types/chat/draft-browser-element-media'

const promptInput = usePromptInput()
const draftMedia = useChatPromptDraftMedia()

const draftFiles = computed(() => promptInput.files.value)
const draftElements = computed(() => draftMedia.items.value)

const hasAttachments = computed(
  () => draftFiles.value.length > 0 || draftElements.value.length > 0,
)

const toElementAttachmentData = (
  item: DraftBrowserElementMedia,
): AttachmentData => ({
  id: item.id,
  type: 'file',
  url: item.previewUrl ?? '',
  filename: item.label,
  mediaType: 'image/png',
})

const handleRemoveFile = (id: string): void => {
  promptInput.removeFile(id)
}

const handleRemoveElement = (id: string): void => {
  draftMedia.remove(id)
}
</script>

<template>
  <div
    v-if="hasAttachments"
    data-align="block-start"
    class="order-first flex w-full flex-wrap items-start justify-start gap-2 px-3 pt-2"
  >
    <Attachments
      variant="grid"
      class="w-full justify-start"
    >
      <Attachment
        v-for="file in draftFiles"
        :key="file.id"
        :data="file"
        class="size-12"
        @remove="handleRemoveFile(file.id)"
      >
        <AttachmentPreview />
        <AttachmentRemove class="top-0.5 right-0.5 size-4 [&>svg]:size-2.5" />
      </Attachment>
      <Attachment
        v-for="item in draftElements"
        :key="item.id"
        :data="toElementAttachmentData(item)"
        class="size-12"
        :title="item.label"
        @remove="handleRemoveElement(item.id)"
      >
        <AttachmentPreview />
        <span
          class="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-background/85 px-0.5 text-center text-[9px] leading-3 text-foreground"
        >
          {{ item.label }}
        </span>
        <AttachmentRemove class="top-0.5 right-0.5 size-4 [&>svg]:size-2.5" />
      </Attachment>
    </Attachments>
  </div>
</template>
