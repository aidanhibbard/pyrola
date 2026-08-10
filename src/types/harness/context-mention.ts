import type { BrowserElementDetail } from '@/types/browser/browser-element-detail'

export type ContextMention =
  | { type: 'file'; path: string; content?: string }
  | { type: 'folder'; path: string; listing?: string }
  | { type: 'rule'; name: string }
  | { type: 'skill'; name: string }
  | {
      type: 'symbol'
      path: string
      name: string
      startLine?: number
      endLine?: number
      content?: string
    }
  | { type: 'codebase'; query: string; content?: string }
  | {
      type: 'browser-element'
      detail: BrowserElementDetail
      screenshotPath: string
    }
