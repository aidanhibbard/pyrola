<script setup lang="ts">
import type { NodeProps } from '@vue-flow/core'
import { Handle, Position } from '@vue-flow/core'

type NeighborhoodNodeRole = 'focus' | 'caller' | 'callee' | 'impact'

type NeighborhoodNodeData = {
  label: string
  path: string
  startLine: number
  role: NeighborhoodNodeRole
}

const props = defineProps<NodeProps<NeighborhoodNodeData>>()

const roleLabel = (role: NeighborhoodNodeRole): string => {
  switch (role) {
    case 'focus':
      return 'Focus'
    case 'caller':
      return 'Caller'
    case 'callee':
      return 'Callee'
    case 'impact':
      return 'Impact'
    default:
      return role
  }
}

const roleClass = (role: NeighborhoodNodeRole): string => {
  switch (role) {
    case 'focus':
      return 'border-primary/60 bg-primary/5'
    case 'caller':
      return 'border-border/60'
    case 'callee':
      return 'border-border/60'
    case 'impact':
      return 'border-amber-500/40'
    default:
      return ''
  }
}
</script>

<template>
  <div
    class="vue-flow__node-neighborhood relative w-50 cursor-pointer rounded-md border bg-card px-0 py-0 shadow-none"
    :class="[
      roleClass(props.data?.role ?? 'impact'),
      props.selected ? 'ring-2 ring-primary/40' : '',
    ]"
  >
    <Handle
      id="target"
      type="target"
      :position="Position.Left"
      class="!bg-muted-foreground !border-background"
    />
    <Handle
      id="source"
      type="source"
      :position="Position.Right"
      class="!bg-muted-foreground !border-background"
    />
    <div class="space-y-0.5 p-2">
      <div class="flex items-center justify-between gap-2">
        <p class="truncate text-sm font-medium">
          {{ props.data?.label }}
        </p>
        <span class="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
          {{ roleLabel(props.data?.role ?? 'impact') }}
        </span>
      </div>
      <p class="truncate text-xs text-muted-foreground">
        {{ props.data?.path }}:{{ props.data?.startLine }}
      </p>
    </div>
  </div>
</template>

