import type { BrowserElementDetail } from '@/types/browser/browser-element-detail'
import type { ContextMention } from '@/types/harness/context-mention'

const formatSymbolLocation = (mention: {
  path: string
  startLine?: number
  endLine?: number
}): string => {
  if (
    typeof mention.startLine === 'number' &&
    typeof mention.endLine === 'number'
  ) {
    return `${mention.path}:${mention.startLine}-${mention.endLine}`
  }
  if (typeof mention.startLine === 'number') {
    return `${mention.path}:${mention.startLine}`
  }
  return mention.path
}

const formatSymbolMention = (mention: {
  path: string
  name: string
  startLine?: number
  endLine?: number
  content?: string
}): string =>
  `Symbol ${mention.name} (${formatSymbolLocation(mention)}):\n${mention.content ?? ''}`

const formatCodebaseMention = (mention: {
  query: string
  content?: string
}): string => `Codebase ${mention.query}:\n${mention.content ?? ''}`

const tagFromXpath = (xpath: string): string => {
  const match = xpath.match(/\/([A-Za-z][\w:-]*)(?:\[\d+\])?$/)
  return match?.[1]?.toLowerCase() ?? 'element'
}

const formatRecord = (record: Record<string, string>, joiner: string): string => {
  const entries = Object.entries(record)
  if (entries.length === 0) {
    return '(none)'
  }
  return entries.map(([key, value]) => `${key}${joiner}${value}`).join('; ')
}

const formatBoundingBox = (
  box: BrowserElementDetail['boundingBox'],
): string => {
  if (!box) {
    return '(none)'
  }
  return `${box.x},${box.y} ${box.width},${box.height}`
}

const formatBrowserElementMention = (mention: {
  detail: BrowserElementDetail
  screenshotPath: string
}): string => {
  const { detail, screenshotPath } = mention
  const tag = tagFromXpath(detail.xpath)
  const lines = [
    `Browser element ${tag} (${detail.xpath}):`,
    `  role: ${detail.role ?? '(none)'}`,
    `  name: ${detail.name ?? '(none)'}`,
    `  attributes: ${formatRecord(detail.attributes, '=')}`,
    `  boundingBox: ${formatBoundingBox(detail.boundingBox)}`,
    `  computedStyles: ${formatRecord(detail.computedStyles, ': ')}`,
    `  screenshot: ${screenshotPath}`,
  ]
  return lines.join('\n')
}

export const formatMentionsAsText = (mentions: ContextMention[]): string => {
  const lines: string[] = []

  for (const mention of mentions) {
    if (mention.type === 'file') {
      lines.push(`File ${mention.path}:\n${mention.content ?? ''}`)
    } else if (mention.type === 'folder') {
      lines.push(`Folder ${mention.path}:\n${mention.listing ?? ''}`)
    } else if (mention.type === 'rule') {
      lines.push(`Rule ${mention.name}`)
    } else if (mention.type === 'skill') {
      lines.push(`Skill ${mention.name}`)
    } else if (mention.type === 'symbol') {
      lines.push(formatSymbolMention(mention))
    } else if (mention.type === 'codebase') {
      lines.push(formatCodebaseMention(mention))
    } else if (mention.type === 'browser-element') {
      lines.push(formatBrowserElementMention(mention))
    }
  }

  return lines.join('\n\n')
}

export const formatMentionBlocks = (
  mentions: ContextMention[],
): { mentions: string; skills: string } => {
  const mentionLines: string[] = []
  const skillLines: string[] = []

  for (const mention of mentions) {
    if (mention.type === 'file') {
      mentionLines.push(`File ${mention.path}:\n${mention.content ?? ''}`)
      continue
    }
    if (mention.type === 'folder') {
      mentionLines.push(`Folder ${mention.path}:\n${mention.listing ?? ''}`)
      continue
    }
    if (mention.type === 'skill') {
      skillLines.push(`Skill ${mention.name}`)
      continue
    }
    if (mention.type === 'rule') {
      mentionLines.push(`Rule ${mention.name}`)
      continue
    }
    if (mention.type === 'symbol') {
      mentionLines.push(formatSymbolMention(mention))
      continue
    }
    if (mention.type === 'codebase') {
      mentionLines.push(formatCodebaseMention(mention))
      continue
    }
    if (mention.type === 'browser-element') {
      mentionLines.push(formatBrowserElementMention(mention))
    }
  }

  return {
    mentions: mentionLines.join('\n\n'),
    skills: skillLines.join('\n'),
  }
}
