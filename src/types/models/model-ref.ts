import type { ReasoningLevel } from '@/types/models/reasoning-level'

export type ModelRef = {
  providerId: string
  modelId: string
  name?: string
  /** True when a -fast / -highspeed sibling exists in the provider catalog. */
  supportsFast?: boolean
  /** Explicit fast slug when known (e.g. moonshotai/kimi-k3-fast). */
  fastModelId?: string
  /** Provider-reported portable reasoning effort levels, when known. */
  supportsReasoningEffort?: ReasoningLevel[]
  /** True when the provider requires a reasoning effort for this model. */
  reasoningMandatory?: boolean
}

export const MODEL_REF_SEPARATOR = '::'
