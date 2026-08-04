import { ref } from 'vue'
import type { FileUIPart } from 'ai'

const mentionAppendToken = ref(0)
const pendingMention = ref<string | null>(null)
const skillAppendToken = ref(0)
const pendingSkill = ref<string | null>(null)
const attachmentAppendToken = ref(0)
const pendingAttachments = ref<FileUIPart[]>([])
const pendingElementText = ref<string | null>(null)

export type BrowserElementAttachment = {
  tabId: string
  url: string
  selector: string
  role?: string
  name?: string
  htmlSnippet?: string
  boundingBox?: { x: number; y: number; width: number; height: number }
  cropScreenshotPath?: string
}

const appendMention = (path: string): void => {
  const trimmed = path.trim()
  if (!trimmed) {
    return
  }
  const mention = trimmed.startsWith('@') ? trimmed : `@${trimmed}`
  pendingMention.value = mention
  mentionAppendToken.value += 1
}

const consumePendingMention = (): string | null => {
  const mention = pendingMention.value
  pendingMention.value = null
  return mention
}

const appendSkill = (name: string): void => {
  const trimmed = name.trim().replace(/^\//, '')
  if (!trimmed) {
    return
  }
  pendingSkill.value = `/${trimmed}`
  skillAppendToken.value += 1
}

const consumePendingSkill = (): string | null => {
  const skill = pendingSkill.value
  pendingSkill.value = null
  return skill
}

const attachBrowserElement = (element: BrowserElementAttachment): void => {
  const selector = element.selector.trim() || '(unknown selector)'
  const lines = [
    `[Browser element] ${selector}`,
    `url: ${element.url}`,
  ]
  if (element.name) {
    lines.push(`name: ${element.name.slice(0, 120)}`)
  }
  if (element.role) {
    lines.push(`role: ${element.role}`)
  }
  if (element.htmlSnippet) {
    lines.push(`html: ${element.htmlSnippet.slice(0, 600)}`)
  }
  pendingElementText.value = lines.join('\n')

  if (element.cropScreenshotPath) {
    pendingAttachments.value = [
      {
        type: 'file',
        mediaType: 'image/png',
        filename: 'element.png',
        url: `file://${element.cropScreenshotPath}`,
      },
    ]
  } else {
    pendingAttachments.value = []
  }
  attachmentAppendToken.value += 1
}

const consumePendingAttachments = (): {
  text: string | null
  files: FileUIPart[]
} => {
  const text = pendingElementText.value
  const files = [...pendingAttachments.value]
  pendingElementText.value = null
  pendingAttachments.value = []
  return { text, files }
}

export default () => ({
  mentionAppendToken,
  appendMention,
  consumePendingMention,
  skillAppendToken,
  appendSkill,
  consumePendingSkill,
  attachmentAppendToken,
  attachBrowserElement,
  consumePendingAttachments,
})
