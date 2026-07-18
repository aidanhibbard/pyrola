import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import { defaultPyrolaSettings } from '@/schemas/pyrola-settings'

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const flattenSettings = (settings: PyrolaSettings): Record<string, unknown> => {
  const flat: Record<string, unknown> = { version: settings.version }

  for (const [key, value] of Object.entries(settings)) {
    if (key === 'version') {
      continue
    }
    flat[key] = value
  }

  return flat
}

export const mergeSettings = (
  personal: PyrolaSettings,
  project: PyrolaSettings | null,
): PyrolaSettings => {
  const base = { ...defaultPyrolaSettings(), ...personal, version: 1 as const }

  if (!project) {
    return base
  }

  const merged: PyrolaSettings = { ...base }

  for (const [key, value] of Object.entries(project)) {
    if (key === 'version') {
      continue
    }
    if (value === undefined) {
      continue
    }
    ;(merged as Record<string, unknown>)[key] = value
  }

  return merged
}

export const getProjectOverrideKeys = (
  personal: PyrolaSettings,
  project: PyrolaSettings,
): string[] => {
  const keys: string[] = []

  for (const key of Object.keys(project)) {
    if (key === 'version') {
      continue
    }
    const projectValue = project[key as keyof PyrolaSettings]
    if (projectValue === undefined) {
      continue
    }
    keys.push(key)
  }

  return keys
}

export const removeSettingsKeys = (
  settings: PyrolaSettings,
  keys: string[],
): PyrolaSettings => {
  const next = { ...settings }

  for (const key of keys) {
    delete (next as Record<string, unknown>)[key]
  }

  return next
}

export const removeSectionOverrides = (
  settings: PyrolaSettings,
  sectionPrefix: string,
): PyrolaSettings => {
  const next: PyrolaSettings = { version: 1 }
  const prefixes =
    sectionPrefix === 'providers'
      ? ['providers.']
      : sectionPrefix === 'models'
        ? ['models.']
        : [`${sectionPrefix}.`]

  for (const [key, value] of Object.entries(settings)) {
    if (key === 'version') {
      continue
    }
    const matches = prefixes.some((prefix) => key.startsWith(prefix) || key === prefix)
    if (!matches) {
      ;(next as Record<string, unknown>)[key] = value
    }
  }

  return next
}

export const parseSettingsRecord = (record: Record<string, unknown>): PyrolaSettings => {
  const settings: PyrolaSettings = { version: 1 }

  for (const [key, value] of Object.entries(record)) {
    if (key === 'version') {
      continue
    }
    if (value === undefined || value === null) {
      continue
    }
    if (key.startsWith('providers.custom.') && isPlainObject(value)) {
      ;(settings as Record<string, unknown>)[key] = value
      continue
    }
    ;(settings as Record<string, unknown>)[key] = value
  }

  return settings
}
