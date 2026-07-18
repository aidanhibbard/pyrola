import { z } from 'zod'
import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import serializeModelRef from '@/utils/serialize-model-ref'
import parseModelRef from '@/utils/parse-model-ref'
import { MODEL_REF_SEPARATOR } from '@/types/models/model-ref'

const themeSchema = z.enum(['light', 'dark', 'system'])
const chatModeSchema = z.enum(['ask', 'plan', 'studio', 'agent', 'orchestrator'])
const duplicateTabBehaviorSchema = z.enum(['ask', 'open-existing', 'open-new'])

const customProviderSchema = z.object({
  type: z.literal('openai-compatible'),
  baseURL: z.string().url(),
  apiKeyRef: z.string().optional(),
  name: z.string().min(1),
})

const modelRefStringSchema = z.string().min(1)

export const pyrolaSettingsSchema = z
  .object({
    version: z.literal(1),
    'appearance.theme': themeSchema.optional(),
    'appearance.fontSize': z.number().int().min(10).max(20).optional(),
    'agent.defaultMode': chatModeSchema.optional(),
    'agent.autoApproveGlobs': z.array(z.string()).optional(),
    'fleet.maxConcurrentAgents': z.number().int().min(1).max(16).optional(),
    'fleet.trayBackground': z.boolean().optional(),
    'general.machineLabel': z.string().optional(),
    'lsp.enabled': z.boolean().optional(),
    'chat.autoTitle': z.boolean().optional(),
    'workbench.duplicateTabBehavior': duplicateTabBehaviorSchema.optional(),
    'models.default': modelRefStringSchema.optional(),
    'models.ask': modelRefStringSchema.optional(),
    'models.plan': modelRefStringSchema.optional(),
    'models.studio': modelRefStringSchema.optional(),
    'models.agent': modelRefStringSchema.optional(),
    'models.orchestrator': modelRefStringSchema.optional(),
    'models.title': modelRefStringSchema.optional(),
    'models.compaction': modelRefStringSchema.optional(),
  })
  .catchall(z.union([z.string(), customProviderSchema, z.number(), z.boolean()]))

export const defaultPyrolaSettings = (): PyrolaSettings => ({
  version: 1,
  'appearance.theme': 'system',
  'appearance.fontSize': 13,
  'agent.defaultMode': 'agent',
  'agent.autoApproveGlobs': ['src/**', 'src-tauri/**'],
  'fleet.maxConcurrentAgents': 4,
  'fleet.trayBackground': false,
  'lsp.enabled': false,
  'chat.autoTitle': true,
  'workbench.duplicateTabBehavior': 'ask',
})

const toModelRefString = (
  providerId: string | undefined,
  modelValue: string | undefined,
): string | undefined => {
  if (!modelValue?.trim()) {
    return undefined
  }

  const trimmed = modelValue.trim()
  if (trimmed.includes(MODEL_REF_SEPARATOR)) {
    return trimmed
  }

  if (providerId) {
    return serializeModelRef({ providerId, modelId: trimmed })
  }

  return trimmed
}

const migrateDeprecatedModelKeys = (record: Record<string, unknown>): Record<string, unknown> => {
  const next = { ...record }
  const legacyProvider =
    typeof next['agent.defaultProvider'] === 'string' ? next['agent.defaultProvider'] : undefined
  const legacyDefaultModel =
    typeof next['agent.defaultModel'] === 'string' ? next['agent.defaultModel'] : undefined
  const legacyTitleModel =
    typeof next['chat.autoTitleModel'] === 'string' ? next['chat.autoTitleModel'] : undefined

  if (!next['models.default'] && legacyDefaultModel) {
    const migrated = toModelRefString(legacyProvider, legacyDefaultModel)
    if (migrated) {
      next['models.default'] = migrated
    }
  }

  if (!next['models.title'] && legacyTitleModel) {
    const migrated = toModelRefString(legacyProvider, legacyTitleModel)
    if (migrated) {
      next['models.title'] = migrated
    }
  }

  delete next['agent.defaultProvider']
  delete next['agent.defaultModel']
  delete next['chat.autoTitleModel']

  return next
}

export const migratePyrolaSettings = (raw: unknown): PyrolaSettings => {
  if (typeof raw !== 'object' || raw === null) {
    return defaultPyrolaSettings()
  }

  const record = raw as Record<string, unknown>
  const version = record.version

  if (version === 1) {
    const migratedRecord = migrateDeprecatedModelKeys(record)
    const parsed = pyrolaSettingsSchema.safeParse(migratedRecord)
    if (parsed.success) {
      return { ...defaultPyrolaSettings(), ...parsed.data }
    }
  }

  return defaultPyrolaSettings()
}

export const normalizeStoredModelRef = (
  value: string | undefined,
  legacyProviderId?: string,
): string | undefined => {
  if (!value?.trim()) {
    return undefined
  }

  const trimmed = value.trim()
  if (parseModelRef(trimmed)) {
    return trimmed
  }

  if (legacyProviderId) {
    return serializeModelRef({ providerId: legacyProviderId, modelId: trimmed })
  }

  return trimmed
}
