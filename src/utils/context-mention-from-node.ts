import type { Editor } from '@tiptap/core'
import type { BrowserElementDetail } from '@/types/browser/browser-element-detail'
import type { ContextMention } from '@/types/harness/context-mention'

export type ChatMentionNodeAttrs = {
  id: string | null
  label: string | null
  mentionSuggestionChar?: string | null
  mentionType: ContextMention['type'] | null
  path: string | null
  name: string | null
  query: string | null
  startLine: number | null
  endLine: number | null
  content: string | null
}

const asType = (value: unknown): ContextMention['type'] | null => {
  if (
    value === 'file' ||
    value === 'folder' ||
    value === 'rule' ||
    value === 'skill' ||
    value === 'symbol' ||
    value === 'codebase' ||
    value === 'browser-element'
  ) {
    return value
  }
  return null
}

const browserElementLabel = (detail: BrowserElementDetail): string =>
  detail.name ?? detail.role ?? detail.cssSelector ?? 'browser-element'

const parseBrowserElementDetail = (raw: string): BrowserElementDetail | null => {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return null
    }
    const record = parsed as Record<string, unknown>
    if (typeof record.xpath !== 'string') {
      return null
    }
    return {
      xpath: record.xpath,
      cssSelector: typeof record.cssSelector === 'string' ? record.cssSelector : null,
      role: typeof record.role === 'string' ? record.role : null,
      name: typeof record.name === 'string' ? record.name : null,
      attributes:
        record.attributes &&
        typeof record.attributes === 'object' &&
        !Array.isArray(record.attributes)
          ? (record.attributes as Record<string, string>)
          : {},
      boundingBox:
        record.boundingBox &&
        typeof record.boundingBox === 'object' &&
        !Array.isArray(record.boundingBox)
          ? (record.boundingBox as BrowserElementDetail['boundingBox'])
          : null,
      computedStyles:
        record.computedStyles &&
        typeof record.computedStyles === 'object' &&
        !Array.isArray(record.computedStyles)
          ? (record.computedStyles as Record<string, string>)
          : {},
      componentHint: typeof record.componentHint === 'string' ? record.componentHint : null,
      screenshotPath:
        typeof record.screenshotPath === 'string' ? record.screenshotPath : null,
      outerHTML: typeof record.outerHTML === 'string' ? record.outerHTML : null,
      innerText: typeof record.innerText === 'string' ? record.innerText : null,
      pageUrl: typeof record.pageUrl === 'string' ? record.pageUrl : null,
      ancestorPath: typeof record.ancestorPath === 'string' ? record.ancestorPath : null,
      matchedCss: typeof record.matchedCss === 'string' ? record.matchedCss : null,
    }
  } catch {
    return null
  }
}

const mentionKey = (mention: ContextMention): string => {
  if (mention.type === 'file' || mention.type === 'folder') {
    return `${mention.type}:${mention.path}`
  }
  if (mention.type === 'symbol') {
    return `symbol:${mention.path}:${mention.name}:${mention.startLine ?? ''}:${mention.endLine ?? ''}`
  }
  if (mention.type === 'codebase') {
    return `codebase:${mention.query}`
  }
  if (mention.type === 'browser-element') {
    return `browser-element:${mention.detail.xpath}:${mention.screenshotPath}`
  }
  return `${mention.type}:${mention.name}`
}

const mentionLabel = (mention: ContextMention): string => {
  if (mention.type === 'file' || mention.type === 'folder') {
    return mention.path
  }
  if (mention.type === 'symbol') {
    return mention.name
  }
  if (mention.type === 'codebase') {
    return `codebase ${mention.query}`
  }
  if (mention.type === 'browser-element') {
    return browserElementLabel(mention.detail)
  }
  return mention.name
}

const toAttrs = (mention: ContextMention): ChatMentionNodeAttrs => {
  const label = mentionLabel(mention)
  const base: ChatMentionNodeAttrs = {
    id: mentionKey(mention),
    label,
    mentionSuggestionChar: mention.type === 'skill' ? '/' : '@',
    mentionType: mention.type,
    path: null,
    name: null,
    query: null,
    startLine: null,
    endLine: null,
    content: null,
  }

  if (mention.type === 'file' || mention.type === 'folder') {
    return { ...base, path: mention.path }
  }
  if (mention.type === 'symbol') {
    return {
      ...base,
      path: mention.path,
      name: mention.name,
      startLine: mention.startLine ?? null,
      endLine: mention.endLine ?? null,
      content: mention.content ?? null,
    }
  }
  if (mention.type === 'codebase') {
    return {
      ...base,
      query: mention.query,
      content: mention.content ?? null,
    }
  }
  if (mention.type === 'browser-element') {
    return {
      ...base,
      path: mention.screenshotPath,
      name: browserElementLabel(mention.detail),
      content: JSON.stringify(mention.detail),
    }
  }
  return { ...base, name: mention.name }
}

const fromAttrs = (attrs: Partial<ChatMentionNodeAttrs>): ContextMention | null => {
  // Slash suggestions always insert skills; prefer the trigger char over the
  // default mentionType ('file') when attrs were partially applied.
  if (attrs.mentionSuggestionChar === '/' || attrs.mentionType === 'skill') {
    const name = attrs.name?.trim() || attrs.label?.trim()
    if (!name) {
      return null
    }
    return { type: 'skill', name }
  }

  const mentionType = asType(attrs.mentionType)
  if (!mentionType) {
    return null
  }

  if (mentionType === 'file') {
    const path = attrs.path?.trim() || attrs.label?.trim() || attrs.id?.trim()
    if (!path) {
      return null
    }
    return { type: 'file', path }
  }

  if (mentionType === 'folder') {
    const path = attrs.path?.trim() || attrs.label?.trim() || attrs.id?.trim()
    if (!path) {
      return null
    }
    return { type: 'folder', path }
  }

  if (mentionType === 'symbol') {
    const name = attrs.name?.trim() || attrs.label?.trim()
    const path = attrs.path?.trim()
    if (!name || !path) {
      return null
    }
    const mention: ContextMention = {
      type: 'symbol',
      path,
      name,
    }
    if (typeof attrs.startLine === 'number') {
      mention.startLine = attrs.startLine
    }
    if (typeof attrs.endLine === 'number') {
      mention.endLine = attrs.endLine
    }
    if (attrs.content?.trim()) {
      mention.content = attrs.content
    }
    return mention
  }

  if (mentionType === 'codebase') {
    const query = attrs.query?.trim() || attrs.label?.replace(/^codebase\s+/i, '').trim()
    if (!query) {
      return null
    }
    const mention: ContextMention = { type: 'codebase', query }
    if (attrs.content?.trim()) {
      mention.content = attrs.content
    }
    return mention
  }

  if (mentionType === 'browser-element') {
    const screenshotPath = attrs.path?.trim()
    const detailRaw = attrs.content?.trim()
    if (!screenshotPath || !detailRaw) {
      return null
    }
    const detail = parseBrowserElementDetail(detailRaw)
    if (!detail) {
      return null
    }
    return { type: 'browser-element', detail, screenshotPath }
  }

  const name = attrs.name?.trim() || attrs.label?.trim()
  if (!name) {
    return null
  }
  return { type: 'rule', name }
}

const collectFromEditor = (editor: Editor): ContextMention[] => {
  const mentions: ContextMention[] = []
  editor.state.doc.descendants((node) => {
    if (node.type.name !== 'mention') {
      return
    }
    const mention = fromAttrs(node.attrs as Partial<ChatMentionNodeAttrs>)
    if (mention) {
      mentions.push(mention)
    }
  })
  return mentions
}

const mergePreservingContent = (
  next: ContextMention[],
  previous: ContextMention[],
): ContextMention[] => {
  const previousByKey = new Map(previous.map((mention) => [mentionKey(mention), mention]))
  return next.map((mention) => {
    const prior = previousByKey.get(mentionKey(mention))
    if (!prior) {
      return mention
    }
    if (
      (mention.type === 'codebase' || mention.type === 'symbol') &&
      !mention.content &&
      prior.type === mention.type &&
      prior.content
    ) {
      return { ...mention, content: prior.content }
    }
    return mention
  })
}

export default {
  mentionKey,
  mentionLabel,
  toAttrs,
  fromAttrs,
  collectFromEditor,
  mergePreservingContent,
}
