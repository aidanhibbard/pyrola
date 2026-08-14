export type SettingsSectionId =
  | 'providers'
  | 'models'
  | 'mcp'
  | 'general'
  | 'graphs'
  | 'agents'
  | 'plans'
  | 'studio'
  | 'rules'
  | 'skills'
  | 'lsp'
  | 'permissions'

export const PERSONAL_SECTIONS: SettingsSectionId[] = [
  'general',
  'graphs',
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

export const SECTION_LABELS: Record<SettingsSectionId, string> = {
  providers: 'Providers',
  models: 'Models',
  mcp: 'MCP',
  general: 'General',
  graphs: 'Graphs',
  agents: 'Agents',
  plans: 'Plans',
  studio: 'Studio',
  rules: 'Rules',
  skills: 'Skills',
  lsp: 'LSP',
  permissions: 'Permissions',
}
