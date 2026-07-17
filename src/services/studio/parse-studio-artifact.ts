import type {
  ParsedStudioArtifact,
  StudioArtifactFrontmatter,
  StudioArtifactStatus,
} from '@/types/studio/studio-artifact'

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/

const parseYamlValue = (raw: string): string => {
  const trimmed = raw.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

const parseFrontmatter = (yaml: string): StudioArtifactFrontmatter => {
  const data: StudioArtifactFrontmatter = {}
  for (const line of yaml.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }
    const colon = trimmed.indexOf(':')
    if (colon === -1) {
      continue
    }
    const key = trimmed.slice(0, colon).trim()
    const value = parseYamlValue(trimmed.slice(colon + 1))
    if (key === 'title') {
      data.title = value
    } else if (key === 'subtitle') {
      data.subtitle = value
    } else if (key === 'status') {
      data.status = value as StudioArtifactStatus
    } else if (key === 'dateRange') {
      data.dateRange = value
    } else if (key === 'source') {
      data.source = value
    }
  }
  return data
}

const parseStudioArtifact = (content: string): ParsedStudioArtifact => {
  const match = content.match(FRONTMATTER_RE)
  if (!match) {
    return { frontmatter: {}, body: content }
  }
  return {
    frontmatter: parseFrontmatter(match[1] ?? ''),
    body: match[2] ?? '',
  }
}

export default parseStudioArtifact

export const serializeStudioArtifact = (
  frontmatter: StudioArtifactFrontmatter,
  body: string,
): string => {
  const lines = ['---']
  if (frontmatter.title) {
    lines.push(`title: ${frontmatter.title}`)
  }
  if (frontmatter.subtitle) {
    lines.push(`subtitle: ${frontmatter.subtitle}`)
  }
  if (frontmatter.status) {
    lines.push(`status: ${frontmatter.status}`)
  }
  if (frontmatter.dateRange) {
    lines.push(`dateRange: ${frontmatter.dateRange}`)
  }
  if (frontmatter.source) {
    lines.push(`source: ${frontmatter.source}`)
  }
  lines.push('---', '')
  return `${lines.join('\n')}${body.trimStart()}`
}

export const updateStudioFrontmatter = (
  content: string,
  patch: Partial<StudioArtifactFrontmatter>,
): string => {
  const parsed = parseStudioArtifact(content)
  return serializeStudioArtifact({ ...parsed.frontmatter, ...patch }, parsed.body)
}
