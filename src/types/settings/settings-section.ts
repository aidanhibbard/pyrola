export type SettingsSectionId =
  | 'appearance'
  | 'providers'
  | 'models'
  | 'mcp'
  | 'fleet'
  | 'general'
  | 'agents'
  | 'plans'
  | 'studio'
  | 'rules'
  | 'skills'
  | 'lsp'

export const PERSONAL_SECTIONS: SettingsSectionId[] = [
  'general',
  'appearance',
  'mcp',
  'providers',
  'models',
  'lsp',
  'fleet',
  'plans',
  'skills',
  'agents',
  'rules',
]

export const PROJECT_SECTIONS: SettingsSectionId[] = [
  'mcp',
  'providers',
  'models',
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
  fleet: 'Fleet',
  general: 'General',
  agents: 'Agents',
  plans: 'Plans',
  studio: 'Studio',
  rules: 'Rules',
  skills: 'Skills',
  lsp: 'LSP',
}
