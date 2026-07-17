export type StudioMetricTone = 'positive' | 'negative' | 'neutral'

export type StudioMetricItem = {
  label: string
  value: string
  delta?: string
  tone?: StudioMetricTone
}

export type StudioTableColumn = {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
}

export type StudioUsageSegment = {
  label: string
  value: number
  color?: string
}

export type StudioChartType = 'bar' | 'line' | 'area'
