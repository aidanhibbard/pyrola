export type SettingsSectionId =
  | 'appearance'
  | 'providers'
  | 'mcp'
  | 'fleet'
  | 'general'
  | 'agents'
  | 'plans'
  | 'studio'
  | 'rules'
  | 'skills'
  | 'search'
  | 'lsp'

export const PERSONAL_SECTIONS: SettingsSectionId[] = [
  'general',
  'appearance',
  'mcp',
  'providers',
  'search',
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
  'search',
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
  mcp: 'MCP',
  fleet: 'Fleet',
  general: 'General',
  agents: 'Agents',
  plans: 'Plans',
  studio: 'Studio',
  rules: 'Rules',
  skills: 'Skills',
  search: 'Search',
  lsp: 'LSP',
}
