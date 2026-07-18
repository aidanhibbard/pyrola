export type SkillScope = 'internal' | 'project' | 'user'

export type SkillIndexEntry = {
  name: string
  description: string
  scope: SkillScope
}

export type LoadedSkill = {
  name: string
  description: string
  scope: SkillScope
  skillDirectory: string
  content: string
  truncated: boolean
}
