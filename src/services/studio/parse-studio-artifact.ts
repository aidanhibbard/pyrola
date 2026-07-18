import {
  formatStudioSchemaError,
  studioFrontmatterSchema,
} from '@/schemas/studio-document'
import type {
  ParsedStudioArtifact,
  StudioArtifactFrontmatter,
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

const parseYamlFrontmatter = (yaml: string): Record<string, unknown> => {
  const data: Record<string, unknown> = {}
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
    data[key] = value
  }
  return data
}

const parseStudioArtifact = (content: string): ParsedStudioArtifact => {
  const match = content.match(FRONTMATTER_RE)
  if (!match) {
    return { frontmatter: {}, body: content }
  }

  const body = match[2] ?? ''
  const rawFrontmatter = parseYamlFrontmatter(match[1] ?? '')
  const result = studioFrontmatterSchema.safeParse(rawFrontmatter)

  if (!result.success) {
    return {
      frontmatter: null,
      body,
      parseError: `Invalid studio frontmatter: ${formatStudioSchemaError(result.error)}`,
    }
  }

  return {
    frontmatter: result.data,
    body,
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
  if (frontmatter.docType) {
    lines.push(`docType: ${frontmatter.docType}`)
  }
  if (frontmatter.slug) {
    lines.push(`slug: ${frontmatter.slug}`)
  }
  if (frontmatter.createdAt) {
    lines.push(`createdAt: ${frontmatter.createdAt}`)
  }
  if (frontmatter.updatedAt) {
    lines.push(`updatedAt: ${frontmatter.updatedAt}`)
  }
  lines.push('---', '')
  return `${lines.join('\n')}${body.trimStart()}`
}

export const updateStudioFrontmatter = (
  content: string,
  patch: Partial<StudioArtifactFrontmatter>,
): string => {
  const parsed = parseStudioArtifact(content)
  if (parsed.parseError || !parsed.frontmatter) {
    return content
  }
  return serializeStudioArtifact({ ...parsed.frontmatter, ...patch }, parsed.body)
}
