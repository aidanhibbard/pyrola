import Mention from '@tiptap/extension-mention'
import type { MentionOptions } from '@tiptap/extension-mention'
import type { SuggestionOptions } from '@tiptap/suggestion'
import type { ChatMentionNodeAttrs } from '@/utils/context-mention-from-node'

type ChatMentionSuggestion = Omit<
  SuggestionOptions<unknown, Partial<ChatMentionNodeAttrs>>,
  'editor'
>

const attrConfig = (key: keyof ChatMentionNodeAttrs, defaultValue: unknown = null) => ({
  default: defaultValue,
  parseHTML: (element: HTMLElement) => {
    const raw = element.getAttribute(`data-${key}`)
    if (raw === null) {
      return defaultValue
    }
    if (key === 'startLine' || key === 'endLine') {
      const parsed = Number.parseInt(raw, 10)
      return Number.isFinite(parsed) ? parsed : defaultValue
    }
    return raw
  },
  renderHTML: (attributes: Record<string, unknown>) => {
    const value = attributes[key]
    if (value === null || value === undefined || value === '') {
      return {}
    }
    return { [`data-${key}`]: String(value) }
  },
})

const mentionChar = (attrs: Record<string, unknown>): string => {
  if (attrs.mentionType === 'skill' || attrs.mentionSuggestionChar === '/') {
    return '/'
  }
  return '@'
}

const mentionClass = (attrs: Record<string, unknown>): string =>
  attrs.mentionType === 'skill' ? 'chat-prompt-skill' : 'chat-prompt-mention'

export default (suggestions: ChatMentionSuggestion[]) =>
  Mention.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        mentionType: attrConfig('mentionType', 'file'),
        path: attrConfig('path'),
        name: attrConfig('name'),
        query: attrConfig('query'),
        startLine: attrConfig('startLine'),
        endLine: attrConfig('endLine'),
        content: attrConfig('content'),
      }
    },
  }).configure({
    HTMLAttributes: {
      class: 'chat-prompt-mention',
    },
    deleteTriggerWithBackspace: true,
    renderText: ({ node }) => {
      const label = node.attrs.label ?? node.attrs.id ?? ''
      return `${mentionChar(node.attrs)}${label}`
    },
    renderHTML: ({ node }) => {
      const label = node.attrs.label ?? node.attrs.id ?? ''
      const char = mentionChar(node.attrs)
      return [
        'span',
        {
          class: mentionClass(node.attrs),
          'data-type': 'mention',
          'data-id': node.attrs.id,
          'data-label': label,
          'data-mention-type': node.attrs.mentionType,
          'data-mention-suggestion-char': char,
        },
        `${char}${label}`,
      ]
    },
    suggestions: suggestions as MentionOptions['suggestions'],
  })
