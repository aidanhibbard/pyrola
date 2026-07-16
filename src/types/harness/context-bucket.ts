export type ContextBucketId =
  | 'system'
  | 'rules'
  | 'skills'
  | 'messages'
  | 'tools'
  | 'subagentDefinitions'
  | 'mentions'

export type ContextBucket = {
  id: ContextBucketId
  label: string
  tokens: number
}
