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

export const PERSONAL_SECTIONS: SettingsSectionId[] = [
  'general',
  'appearance',
  'mcp',
  'providers',
  'fleet',
  'plans',
  'studio',
  'skills',
  'agents',
]

export const PROJECT_SECTIONS: SettingsSectionId[] = [
  'mcp',
  'providers',
  'plans',
  'studio',
  'skills',
  'agents',
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
}
