import { z } from 'zod'

const fleetProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  rootPath: z.string().min(1),
  lastOpened: z.string(),
})

export const fleetProjectsRegistrySchema = z.object({
  version: z.literal(1),
  projects: z.array(fleetProjectSchema),
})

export const fleetActiveProjectSchema = z.object({
  projectId: z.string().uuid().nullable(),
})

export const defaultFleetProjectsRegistry = (): z.infer<typeof fleetProjectsRegistrySchema> => ({
  version: 1,
  projects: [],
})

export const defaultFleetActiveProject = (): z.infer<typeof fleetActiveProjectSchema> => ({
  projectId: null,
})
