export const REASONING_LEVELS = [
  'provider-default',
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] as const

export type ReasoningLevel = (typeof REASONING_LEVELS)[number]

export const REASONING_LEVEL_LABELS: Record<ReasoningLevel, string> = {
  'provider-default': 'Default',
  none: 'None',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Max',
}

export const isReasoningLevel = (value: unknown): value is ReasoningLevel =>
  typeof value === 'string' && (REASONING_LEVELS as readonly string[]).includes(value)

export const PORTABLE_REASONING_LEVELS: ReasoningLevel[] = [...REASONING_LEVELS]
