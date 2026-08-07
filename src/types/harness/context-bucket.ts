export type ContextBucketId =
  | 'system'
  | 'rules'
  | 'skills'
  | 'messages'
  | 'tools'
  | 'mcp'
  | 'subagentDefinitions'
  | 'mentions'

export type ContextBucket = {
  id: ContextBucketId
  label: string
  tokens: number
}
