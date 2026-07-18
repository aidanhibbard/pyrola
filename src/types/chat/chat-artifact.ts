export type ChatArtifact = {
  kind: 'plan' | 'studio' | 'file'
  path: string
  label?: string
}
