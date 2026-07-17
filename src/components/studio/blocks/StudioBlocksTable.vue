<script setup lang="ts">
import { computed } from 'vue'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/ui/table'
import type { StudioTableColumn } from '@/types/studio/studio-block-props'

type TableRowData = Record<string, string | number>

const props = defineProps<{
  title?: string
  columns?: StudioTableColumn[]
  rows?: TableRowData[]
}>()

const resolvedColumns = computed((): StudioTableColumn[] => {
  if (props.columns && props.columns.length > 0) {
    return props.columns
  }
  const first = props.rows?.[0]
  if (!first) {
    return []
  }
  return Object.keys(first).map((key) => ({ key, label: key }))
})

const tableRows = computed(() => props.rows ?? [])
</script>

<template>
  <section v-if="tableRows.length > 0 && resolvedColumns.length > 0" class="space-y-3">
    <h3 v-if="title" class="text-base font-semibold tracking-tight">{{ title }}</h3>
    <div class="overflow-hidden rounded-lg border border-border/40">
      <Table>
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead
              v-for="column in resolvedColumns"
              :key="column.key"
              class="h-9 px-3 text-xs"
              :class="column.align === 'right' ? 'text-right' : ''"
            >
              {{ column.label }}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="(row, rowIndex) in tableRows" :key="rowIndex" class="hover:bg-muted/30">
            <TableCell
              v-for="column in resolvedColumns"
              :key="`${rowIndex}-${column.key}`"
              class="px-3 py-2.5"
              :class="column.align === 'right' ? 'text-right tabular-nums' : ''"
            >
              {{ row[column.key] }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </section>
</template>
