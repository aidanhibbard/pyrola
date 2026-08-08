export type SettingsSectionId =
  | 'appearance'
  | 'providers'
  | 'models'
  | 'mcp'
  | 'general'
  | 'agents'
  | 'plans'
  | 'studio'
  | 'rules'
  | 'skills'
  | 'lsp'
  | 'permissions'

export const PERSONAL_SECTIONS: SettingsSectionId[] = [
  'general',
  'appearance',
  'mcp',
  'providers',
  'models',
  'lsp',
  'permissions',
  'plans',
  'skills',
  'agents',
  'rules',
]

export const PROJECT_SECTIONS: SettingsSectionId[] = [
  'mcp',
  'lsp',
  'plans',
  'studio',
  'skills',
  'agents',
  'rules',
]

export const SECTION_LABELS: Record<SettingsSectionId, string> = {
  appearance: 'Appearance',
  providers: 'Providers',
  models: 'Models',
  mcp: 'MCP',
  general: 'General',
  agents: 'Agents',
  plans: 'Plans',
  studio: 'Studio',
  rules: 'Rules',
  skills: 'Skills',
  lsp: 'LSP',
  permissions: 'Permissions',
}
