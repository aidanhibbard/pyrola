import type { ModelRoleId } from '@/data/model-role-registry'
import type { PyrolaChatMode, PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import parseModelRef from '@/utils/parse-model-ref'

const isChatMode = (role: ModelRoleId): role is PyrolaChatMode =>
  role === 'ask' ||
  role === 'plan' ||
  role === 'studio' ||
  role === 'agent' ||
  role === 'orchestrator'

const readSettingsModel = (
  settings: PyrolaSettings,
  key: `models.${string}`,
): string | undefined => settings[key]

export const resolveModelForRole = (
  role: ModelRoleId,
  settings: PyrolaSettings,
  chatOverride?: string,
): string | undefined => {
  if (chatOverride?.trim()) {
    return chatOverride.trim()
  }

  if (role === 'default') {
    return readSettingsModel(settings, 'models.default')
  }

  const roleKey = `models.${role}` as const
  const roleValue = readSettingsModel(settings, roleKey)
  if (roleValue) {
    return roleValue
  }

  if (isChatMode(role) || role === 'title' || role === 'compaction') {
    return readSettingsModel(settings, 'models.default')
  }

  return undefined
}

export default resolveModelForRole

export const resolveParsedModelForRole = (
  role: ModelRoleId,
  settings: PyrolaSettings,
  chatOverride?: string,
  legacyProviderId?: string,
): ReturnType<typeof parseModelRef> => {
  const serialized = resolveModelForRole(role, settings, chatOverride)
  if (!serialized) {
    return null
  }
  return parseModelRef(serialized, { legacyProviderId })
}
