import parseSkillFrontmatter from '@/services/skills/strip-skill-frontmatter'

const promptModules = import.meta.glob('../../prompts/**/*.{md,yaml}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const resolvePromptModuleKey = (relativePath: string): string | null => {
  const normalized = relativePath.replace(/^\//, '')
  const suffix = `/prompts/${normalized}`
  return Object.keys(promptModules).find((path) => path.endsWith(suffix)) ?? null
}

const substituteVariables = (text: string, variables: Record<string, string>): string => {
  let result = text
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{{${key}}}`, value)
  }
  return result
}

export default (relativePath: string, variables: Record<string, string> = {}): string => {
  const moduleKey = resolvePromptModuleKey(relativePath)
  if (!moduleKey) {
    throw new Error(`Prompt not found: ${relativePath}`)
  }

  const raw = promptModules[moduleKey]
  if (!raw) {
    throw new Error(`Prompt not found: ${relativePath}`)
  }
  const { body } = parseSkillFrontmatter(raw)
  return substituteVariables(body.trim(), variables)
}
