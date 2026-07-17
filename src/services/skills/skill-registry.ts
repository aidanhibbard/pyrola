import type { PyrolaChatMode } from '@/types/pyrola/pyrola-settings'
import type { LoadedSkill, SkillIndexEntry } from '@/types/skills/skill'
import { listInternalSkillIndex, loadInternalSkill } from '@/services/skills/discover-internal-skills'
import {
  discoverProjectSkillIndex,
  loadProjectSkill,
} from '@/services/skills/discover-project-skills'
import { MAX_SKILL_CONTENT_CHARS } from '@/services/skills/strip-skill-frontmatter'

export const listSkillIndex = async (
  mode: PyrolaChatMode,
  projectRoot: string,
): Promise<SkillIndexEntry[]> => {
  const internal = listInternalSkillIndex(mode)
  const project = await discoverProjectSkillIndex(projectRoot)
  const byName = new Map<string, SkillIndexEntry>()
  for (const skill of internal) {
    byName.set(skill.name.toLowerCase(), skill)
  }
  for (const skill of project) {
    byName.set(skill.name.toLowerCase(), skill)
  }
  return [...byName.values()]
}

export const loadSkill = async (
  name: string,
  projectRoot: string,
): Promise<LoadedSkill | { error: string }> => {
  const normalized = name.trim().toLowerCase()
  if (!normalized) {
    return { error: 'Skill name is required' }
  }

  const internal = loadInternalSkill(normalized)
  const project = internal ? null : await loadProjectSkill(projectRoot, normalized)
  const resolved = internal ?? project

  if (!resolved) {
    return { error: `Skill '${name}' not found` }
  }

  const scope = internal ? 'internal' : 'project'
  let content = resolved.content
  let truncated = false
  if (content.length > MAX_SKILL_CONTENT_CHARS) {
    content = `${content.slice(0, MAX_SKILL_CONTENT_CHARS)}\n\n[Skill content truncated — ${content.length - MAX_SKILL_CONTENT_CHARS} more characters omitted]`
    truncated = true
  }

  return {
    name: normalized,
    description: resolved.description,
    scope,
    skillDirectory: resolved.skillDirectory,
    content,
    truncated,
  }
}
