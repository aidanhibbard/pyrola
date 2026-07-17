import type { Component } from 'vue'
import StudioBlocksCallout from '@/components/studio/blocks/StudioBlocksCallout.vue'
import StudioBlocksChart from '@/components/studio/blocks/StudioBlocksChart.vue'
import StudioBlocksDivider from '@/components/studio/blocks/StudioBlocksDivider.vue'
import StudioBlocksGrid from '@/components/studio/blocks/StudioBlocksGrid.vue'
import StudioBlocksMermaid from '@/components/studio/blocks/StudioBlocksMermaid.vue'
import StudioBlocksMetrics from '@/components/studio/blocks/StudioBlocksMetrics.vue'
import StudioBlocksPageHeader from '@/components/studio/blocks/StudioBlocksPageHeader.vue'
import StudioBlocksPill from '@/components/studio/blocks/StudioBlocksPill.vue'
import StudioBlocksRow from '@/components/studio/blocks/StudioBlocksRow.vue'
import StudioBlocksTable from '@/components/studio/blocks/StudioBlocksTable.vue'
import StudioBlocksUsageBar from '@/components/studio/blocks/StudioBlocksUsageBar.vue'

const studioBlocks: Record<string, Component> = {
  'page-header': StudioBlocksPageHeader,
  metrics: StudioBlocksMetrics,
  stat: StudioBlocksMetrics,
  chart: StudioBlocksChart,
  table: StudioBlocksTable,
  callout: StudioBlocksCallout,
  grid: StudioBlocksGrid,
  row: StudioBlocksRow,
  mermaid: StudioBlocksMermaid,
  'usage-bar': StudioBlocksUsageBar,
  pill: StudioBlocksPill,
  divider: StudioBlocksDivider,
}

export default studioBlocks
