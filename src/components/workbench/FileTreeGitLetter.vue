<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/shadcn/ui/tooltip'
import { cn } from '@/lib/utils'
import type { GitFileDecoration } from '@/types/git/git-file-decoration'
import {
  decorationClass,
  decorationLabel,
  decorationLetter,
} from '@/utils/git-file-decoration'

interface Props extends /* @vue-ignore */ HTMLAttributes {
  status: GitFileDecoration
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <span
        :class="
          cn(
            'inline-flex w-3.5 shrink-0 justify-center font-mono text-[11px] font-semibold leading-none',
            decorationClass(props.status),
            props.class,
          )
        "
        :aria-label="decorationLabel(props.status)"
        v-bind="$attrs"
      >
        {{ decorationLetter(props.status) }}
      </span>
    </TooltipTrigger>
    <TooltipContent>{{ decorationLabel(props.status) }}</TooltipContent>
  </Tooltip>
</template>
