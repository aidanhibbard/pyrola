<script setup lang="ts">
import { ChevronDownIcon } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
</script>

<template>
  <DropdownMenuTrigger v-bind="$attrs" as-child>
    <slot>
      <Button type="button" variant="outline">
        Open in chat
        <ChevronDownIcon class="ml-2 size-4" />
      </Button>
    </slot>
  </DropdownMenuTrigger>
</template>
