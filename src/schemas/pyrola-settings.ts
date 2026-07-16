import { z } from 'zod'
import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'

const themeSchema = z.enum(['light', 'dark', 'system'])
const glassVariantSchema = z.enum(['light', 'dark'])
const chatModeSchema = z.enum(['ask', 'plan', 'studio', 'agent'])

const customProviderSchema = z.object({
  type: z.literal('openai-compatible'),
  baseURL: z.string().url(),
  apiKeyRef: z.string().optional(),
  name: z.string().min(1),
})

export const pyrolaSettingsSchema = z
  .object({
    version: z.literal(1),
    'appearance.theme': themeSchema.optional(),
    'appearance.glass': z.boolean().optional(),
    'appearance.glassVariant': glassVariantSchema.optional(),
    'agent.defaultProvider': z.string().optional(),
    'agent.defaultModel': z.string().optional(),
    'agent.defaultMode': chatModeSchema.optional(),
    'fleet.maxConcurrentAgents': z.number().int().min(1).max(16).optional(),
    'fleet.trayBackground': z.boolean().optional(),
    'general.machineLabel': z.string().optional(),
  })
  .catchall(z.union([z.string(), customProviderSchema, z.number(), z.boolean()]))

export const defaultPyrolaSettings = (): PyrolaSettings => ({
  version: 1,
  'appearance.theme': 'system',
  'appearance.glass': true,
  'appearance.glassVariant': 'dark',
  'agent.defaultMode': 'agent',
  'fleet.maxConcurrentAgents': 4,
  'fleet.trayBackground': false,
})

export const migratePyrolaSettings = (
  raw: unknown,
): PyrolaSettings => {
  if (typeof raw !== 'object' || raw === null) {
    return defaultPyrolaSettings()
  }

  const record = raw as Record<string, unknown>
  const version = record.version

  if (version === 1) {
    const parsed = pyrolaSettingsSchema.safeParse(raw)
    if (parsed.success) {
      return { ...defaultPyrolaSettings(), ...parsed.data }
    }
  }

  return defaultPyrolaSettings()
}
