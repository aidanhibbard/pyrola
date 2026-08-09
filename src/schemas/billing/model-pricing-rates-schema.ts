import { z } from 'zod'

const modelPricingRatesSchema = z.object({
  inputPerMillion: z.number().min(0),
  outputPerMillion: z.number().min(0),
  cacheReadPerMillion: z.number().min(0).optional(),
  cacheWritePerMillion: z.number().min(0).optional(),
  reasoningPerMillion: z.number().min(0).optional(),
})

export default modelPricingRatesSchema
