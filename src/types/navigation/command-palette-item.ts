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

export type CommandPaletteTab =
  | 'All'
  | 'Agents'
  | 'Files'
  | 'Actions'
  | 'Settings'

export const COMMAND_PALETTE_TABS: CommandPaletteTab[] = [
  'All',
  'Agents',
  'Files',
  'Actions',
  'Settings',
]

export const getCommandPaletteTab = (
  item: CommandPaletteItem,
): Exclude<CommandPaletteTab, 'All'> => {
  if (item.group === 'Settings' || item.settingsSection) {
    return 'Settings'
  }

  if (item.group === 'Chats' || item.group === 'Pinned') {
    return 'Agents'
  }

  if (item.group === 'Projects') {
    return 'Files'
  }

  if (item.action === 'new-agent') {
    return 'Agents'
  }

  if (item.action === 'open-editor') {
    return 'Files'
  }

  return 'Actions'
}
