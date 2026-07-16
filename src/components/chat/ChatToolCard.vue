<script setup lang="ts">
import type { FileDiff } from '@/types/harness/file-diff'
import ChatApprovalActions from '@/components/chat/ApprovalActions.vue'
import ChatInlineFileDiff from '@/components/chat/InlineFileDiff.vue'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/shadcn/ui/collapsible'
import { Marker, MarkerContent } from '@/components/shadcn/ui/marker'

defineProps<{
  toolCallId: string
  name: string
  diffs: FileDiff[]
}>()

const emit = defineEmits<{
  approve: []
  reject: []
}>()
</script>

<template>
  <Collapsible default-open class="w-full">
    <CollapsibleTrigger as-child>
      <Marker variant="border" class="w-full cursor-pointer">
        <MarkerContent>
          {{ name }} — approval required
        </MarkerContent>
      </Marker>
    </CollapsibleTrigger>
    <CollapsibleContent class="space-y-2 px-2 py-2">
      <ChatInlineFileDiff
        v-for="diff in diffs"
        :key="diff.path"
        :diff="diff"
      />
      <ChatApprovalActions
        @approve="emit('approve')"
        @reject="emit('reject')"
      />
    </CollapsibleContent>
  </Collapsible>
</template>
