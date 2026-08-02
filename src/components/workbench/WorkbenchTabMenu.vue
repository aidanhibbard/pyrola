<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/shadcn/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/shadcn/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/shadcn/ui/tooltip'
import useWorkbenchStore from '@/composables/use-workbench-store'

const workbench = useWorkbenchStore()

const activeTabId = computed(() => workbench.activeTabId.value)
</script>

<template>
  <Tooltip :disable-closing-trigger="true">
    <TooltipTrigger as-child>
      <span class="inline-flex shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="icon" class="h-7 w-7" aria-label="Tab menu">
              <span class="text-xs">⋯</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              :disabled="!activeTabId"
              @click="activeTabId && workbench.closeOthers(activeTabId)"
            >
              Close others
            </DropdownMenuItem>
            <DropdownMenuItem @click="workbench.closeAll()">
              Close all
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </TooltipTrigger>
    <TooltipContent>Tab menu</TooltipContent>
  </Tooltip>
</template>
