export type ModelRef = {
  providerId: string
  modelId: string
  name?: string
  /** True when a -fast / -highspeed sibling exists in the provider catalog. */
  supportsFast?: boolean
  /** Explicit fast slug when known (e.g. moonshotai/kimi-k3-fast). */
  fastModelId?: string
}

export const MODEL_REF_SEPARATOR = '::'

