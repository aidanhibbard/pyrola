import type { z } from 'zod'
import type { studioDocTypeSchema, studioFrontmatterSchema } from '@/schemas/studio-document'

export type StudioArtifactStatus = 'draft' | 'published'

export type StudioArtifactDocType = z.infer<typeof studioDocTypeSchema>

export type StudioArtifactFrontmatter = z.infer<typeof studioFrontmatterSchema>

export type ParsedStudioArtifact = {
  frontmatter: StudioArtifactFrontmatter | null
  body: string
  parseError?: string
}
