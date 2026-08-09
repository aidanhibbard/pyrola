export type ProjectSectionId =
  | 'chats'
  | 'mcp'
  | 'plans'
  | 'studio'
  | 'skills'
  | 'agents'
  | 'rules'

export const PROJECT_SECTIONS: ProjectSectionId[] = [
  'chats',
  'mcp',
  'plans',
  'studio',
  'skills',
  'agents',
  'rules',
]

export const PROJECT_SECTION_LABELS: Record<ProjectSectionId, string> = {
  chats: 'Chats',
  mcp: 'MCP',
  plans: 'Plans',
  studio: 'Studio',
  skills: 'Skills',
  agents: 'Agents',
  rules: 'Rules',
}
