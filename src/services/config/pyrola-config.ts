import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import { defaultPyrolaSettings, migratePyrolaSettings } from '@/schemas/pyrola-settings'
import {
  mergeSettings,
  parseSettingsRecord,
  removeSectionOverrides,
  removeSettingsKeys,
} from '@/services/config/merge-settings'
import {
  readSettings,
  writeSettings,
  type ConfigScope,
} from '@/services/pyrola/pyrola-tauri'

export type PyrolaConfigScope = ConfigScope | 'effective'

const toSettings = (raw: Record<string, unknown>): PyrolaSettings => {
  const migrated = migratePyrolaSettings(raw)
  return { ...defaultPyrolaSettings(), ...parseSettingsRecord(migrated as Record<string, unknown>) }
}

export const loadPersonalSettings = async (): Promise<PyrolaSettings> => {
  const raw = await readSettings('personal')
  return toSettings(raw)
}

export const loadProjectSettings = async (rootPath: string): Promise<PyrolaSettings> => {
  const raw = await readSettings('project', rootPath)
  const record = raw as Record<string, unknown>
  if (Object.keys(record).length === 0) {
    return { version: 1 }
  }
  return toSettings(record)
}

export const loadEffectiveSettings = async (
  rootPath: string | null,
): Promise<PyrolaSettings> => {
  const personal = await loadPersonalSettings()
  if (!rootPath) {
    return personal
  }
  const project = await loadProjectSettings(rootPath)
  return mergeSettings(personal, project)
}

export const saveSettings = async (
  scope: ConfigScope,
  settings: PyrolaSettings,
  rootPath?: string | null,
): Promise<void> => {
  await writeSettings(scope, settings as Record<string, unknown>, rootPath)
}

export const resetSettingsKeys = async (
  scope: ConfigScope,
  keys: string[],
  settings: PyrolaSettings,
  rootPath?: string | null,
): Promise<PyrolaSettings> => {
  const next = removeSettingsKeys(settings, keys)
  await saveSettings(scope, next, rootPath)
  return next
}

export const resetSettingsSection = async (
  scope: ConfigScope,
  sectionPrefix: string,
  settings: PyrolaSettings,
  rootPath?: string | null,
): Promise<PyrolaSettings> => {
  const next = removeSectionOverrides(settings, sectionPrefix)
  await saveSettings(scope, next, rootPath)
  return next
}

export const isProjectOverride = (project: PyrolaSettings, key: string): boolean =>
  key in project && key !== 'version'
