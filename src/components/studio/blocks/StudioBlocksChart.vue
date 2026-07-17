<script setup lang="ts">
import { computed } from 'vue'
import { VisAxis, VisGroupedBar, VisLine, VisXYContainer } from '@unovis/vue'
import {
  ChartContainer,
  ChartCrosshair,
  ChartTooltip,
  type ChartConfig,
} from '@/components/shadcn/ui/chart'
import type { StudioChartType } from '@/types/studio/studio-block-props'

type ChartRow = Record<string, string | number>

const props = defineProps<{
  type?: StudioChartType | string
  title?: string
  xLabel?: string
  yLabel?: string
  source?: string
  data?: ChartRow[]
  xKey?: string
  yKey?: string
}>()

const chartType = computed<StudioChartType>(() => {
  const value = props.type ?? 'bar'
  if (value === 'line' || value === 'area') {
    return value
  }
  return 'bar'
})

const rows = computed(() => props.data ?? [])

const xField = computed(() => {
  if (props.xKey) {
    return props.xKey
  }
  const first = rows.value[0]
  if (!first) {
    return 'label'
  }
  const key = Object.keys(first).find((k) => typeof first[k] === 'string')
  return key ?? 'label'
})

const yField = computed(() => {
  if (props.yKey) {
    return props.yKey
  }
  const first = rows.value[0]
  if (!first) {
    return 'value'
  }
  const key = Object.keys(first).find((k) => typeof first[k] === 'number')
  return key ?? 'value'
})

const chartConfig = computed<ChartConfig>(() => ({
  value: {
    label: props.yLabel ?? yField.value,
    color: 'var(--chart-1)',
  },
}))

const xIndexAccessor = (_row: ChartRow, index: number): number => index
const yAccessor = (row: ChartRow): number => Number(row[yField.value] ?? 0)

const xTickValues = computed(() => rows.value.map((_, index) => index))

const formatXTick = (tick: number): string => {
  if (!Number.isInteger(tick)) {
    return ''
  }
  const row = rows.value[tick]
  if (!row) {
    return ''
  }
  return String(row[xField.value] ?? '')
}
</script>

<template>
  <section v-if="rows.length > 0" class="space-y-3">
    <div v-if="title || source" class="space-y-0.5">
      <h3 v-if="title" class="text-base font-semibold tracking-tight">{{ title }}</h3>
      <p v-if="source" class="text-xs text-muted-foreground">{{ source }}</p>
    </div>
    <ChartContainer :config="chartConfig" class="aspect-5/3 min-h-[180px] w-full">
      <VisXYContainer :data="rows" :padding="{ top: 4, bottom: 24, left: 36, right: 8 }">
        <VisGroupedBar
          v-if="chartType === 'bar'"
          :x="xIndexAccessor"
          :y="yAccessor"
          color="var(--color-value)"
          :rounded-corners="3"
          bar-padding="0.18"
          group-padding="0"
        />
        <VisLine
          v-else
          :x="xIndexAccessor"
          :y="yAccessor"
          color="var(--color-value)"
          :attributes="{ 'stroke-width': 2 }"
        />
        <VisAxis
          type="x"
          :label="xLabel"
          :tick-format="formatXTick"
          :tick-values="xTickValues"
          :tick-line="false"
          :domain-line="false"
          :grid-line="false"
        />
        <VisAxis
          type="y"
          :label="yLabel"
          :tick-line="false"
          :domain-line="false"
          :grid-line="true"
        />
        <ChartTooltip />
        <ChartCrosshair />
      </VisXYContainer>
    </ChartContainer>
  </section>
</template>
