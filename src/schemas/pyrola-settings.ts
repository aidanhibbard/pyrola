import { z } from 'zod'
import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'

const themeSchema = z.enum(['light', 'dark', 'system'])
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
    'agent.defaultProvider': z.string().optional(),
    'agent.defaultModel': z.string().optional(),
    'agent.defaultMode': chatModeSchema.optional(),
    'agent.autoApproveGlobs': z.array(z.string()).optional(),
    'fleet.maxConcurrentAgents': z.number().int().min(1).max(16).optional(),
    'fleet.trayBackground': z.boolean().optional(),
    'general.machineLabel': z.string().optional(),
    'search.provider': z.enum(['tavily', 'brave', 'custom']).optional(),
    'search.apiKeyRef': z.string().optional(),
    'search.customBaseUrl': z.string().url().optional(),
    'lsp.enabled': z.boolean().optional(),
    'chat.autoTitle': z.boolean().optional(),
    'chat.autoTitleModel': z.string().optional(),
  })
  .catchall(z.union([z.string(), customProviderSchema, z.number(), z.boolean()]))

export const defaultPyrolaSettings = (): PyrolaSettings => ({
  version: 1,
  'appearance.theme': 'system',
  'agent.defaultMode': 'agent',
  'agent.autoApproveGlobs': ['src/**', 'src-tauri/**'],
  'fleet.maxConcurrentAgents': 4,
  'fleet.trayBackground': false,
  'search.provider': 'tavily',
  'lsp.enabled': false,
  'chat.autoTitle': true,
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
