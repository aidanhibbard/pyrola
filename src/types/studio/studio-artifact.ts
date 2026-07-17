export type StudioArtifactStatus = 'draft' | 'published'

export type StudioArtifactFrontmatter = {
  title?: string
  subtitle?: string
  status?: StudioArtifactStatus
  dateRange?: string
  source?: string
}

export type ParsedStudioArtifact = {
  frontmatter: StudioArtifactFrontmatter
  body: string
}
