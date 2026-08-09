export type ProjectSectionId =
  | 'chats'
  | 'mcp'
  | 'codegraph'
  | 'plans'
  | 'studio'
  | 'skills'
  | 'agents'
  | 'rules'

export const PROJECT_SECTIONS: ProjectSectionId[] = [
  'chats',
  'mcp',
  'codegraph',
  'plans',
  'studio',
  'skills',
  'agents',
  'rules',
]

export const PROJECT_SECTION_LABELS: Record<ProjectSectionId, string> = {
  chats: 'Chats',
  mcp: 'MCP',
  codegraph: 'Graph',
  plans: 'Plans',
  studio: 'Studio',
  skills: 'Skills',
  agents: 'Agents',
  rules: 'Rules',
}
