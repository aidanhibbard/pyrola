import { z } from 'zod'

const studioDataSchema = z.record(z.unknown())

export default studioDataSchema
