import { z } from 'zod'
import { REASONING_LEVELS } from '@/types/models/reasoning-level'

export const reasoningLevelSchema = z.enum(REASONING_LEVELS)

export default reasoningLevelSchema
