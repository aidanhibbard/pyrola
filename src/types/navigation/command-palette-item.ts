import type { SettingsSectionId } from '@/types/settings/settings-section'

export type CommandPaletteGroup =
  | 'Actions'
  | 'Projects'
  | 'Chats'
  | 'Pinned'
  | 'Settings'

export type CommandPaletteAction =
  | 'new-agent'
  | 'open-settings'
  | 'open-terminal'
  | 'open-editor'

export interface CommandPaletteItem {
  id: string
  group: CommandPaletteGroup
  label: string
  subtitle?: string
  projectSlug?: string
  chatId?: string
  settingsSection?: SettingsSectionId
  action?: CommandPaletteAction
}
