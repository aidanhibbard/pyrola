<script setup lang="ts">
import { ref } from 'vue'
import { Input } from '@/components/shadcn/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/shadcn/ui/popover'
import { Button } from '@/components/shadcn/ui/button'

const emit = defineEmits<{
  select: [mention: { type: 'file' | 'folder'; path: string }]
}>()

const query = ref('')
const open = ref(false)

const handleSelect = (path: string, type: 'file' | 'folder'): void => {
  emit('select', { type, path })
  open.value = false
  query.value = ''
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button size="sm" variant="ghost" class="h-7 px-2 text-xs">
        @ Context
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-72 p-2" align="start">
      <Input
        v-model="query"
        placeholder="Search files…"
        class="h-8"
      />
      <div class="mt-2 space-y-1 text-sm text-muted-foreground">
        <p>Type a path or pick from workbench file tree.</p>
        <Button
          v-if="query.trim()"
          variant="ghost"
          class="h-7 w-full justify-start px-2"
          @click="handleSelect(query.trim(), 'file')"
        >
          File: {{ query.trim() }}
        </Button>
      </div>
    </PopoverContent>
  </Popover>
</template>
