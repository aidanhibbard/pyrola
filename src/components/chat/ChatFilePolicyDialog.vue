<script setup lang="ts">
import { computed } from 'vue'
import type { AggregatedTurnFileChange } from '@/types/harness/file-checkpoint'
import { Button } from '@/components/shadcn/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/shadcn/ui/alert-dialog'
import { summarizeMutationCounts } from '@/services/harness/restore-file-checkpoints'

const props = defineProps<{
  open: boolean
  title: string
  changes: AggregatedTurnFileChange[]
  emphasizeRevert?: boolean
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  keep: []
  revert: []
}>()

const counts = computed(() => summarizeMutationCounts(props.changes))

const detail = computed(() => {
  const parts: string[] = []
  if (counts.value.created > 0) {
    parts.push(
      `${counts.value.created} created file${counts.value.created === 1 ? '' : 's'} removed on revert`,
    )
  }
  if (counts.value.updated > 0) {
    parts.push(
      `${counts.value.updated} updated`,
    )
  }
  if (counts.value.deleted > 0) {
    parts.push(
      `${counts.value.deleted} deleted restored`,
    )
  }
  if (counts.value.renamed > 0) {
    parts.push(
      `${counts.value.renamed} renamed`,
    )
  }
  return parts.join(', ')
})

const handleOpenChange = (open: boolean): void => {
  emit('update:open', open)
}

const handleKeep = (): void => {
  emit('update:open', false)
  emit('keep')
}

const handleRevert = (): void => {
  emit('update:open', false)
  emit('revert')
}
</script>

<template>
  <AlertDialog
    :open="open"
    @update:open="handleOpenChange"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ title }}</AlertDialogTitle>
        <AlertDialogDescription>
          The conversation after this point will be discarded.
          {{ counts.files }} file{{ counts.files === 1 ? '' : 's' }} were changed by the agent
          <template v-if="detail">
            ({{ detail }}).
          </template>
          <template v-else>.</template>
          Keep files leaves disk unchanged. Revert files rolls those paths back
          and overwrites any manual edits on them.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter class="flex-col gap-2 sm:flex-row sm:justify-end">
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <Button
          type="button"
          :variant="emphasizeRevert ? 'secondary' : 'default'"
          @click="handleKeep"
        >
          Keep files
        </Button>
        <Button
          type="button"
          :variant="emphasizeRevert ? 'destructive' : 'secondary'"
          @click="handleRevert"
        >
          Revert files
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
