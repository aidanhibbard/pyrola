export type ContextMention =
  | { type: 'file'; path: string; content?: string }
  | { type: 'folder'; path: string; listing?: string }
  | { type: 'rule'; name: string }
  | { type: 'skill'; name: string }
