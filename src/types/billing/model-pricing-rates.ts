/** USD per 1M tokens. */
export type ModelPricingRates = {
  inputPerMillion: number
  outputPerMillion: number
  cacheReadPerMillion?: number
  cacheWritePerMillion?: number
  reasoningPerMillion?: number
}
