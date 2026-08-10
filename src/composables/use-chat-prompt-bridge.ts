import { ref } from 'vue'
import type { BrowserElementSelection } from '@/types/browser/browser-element-selection'
import type { ContextMention } from '@/types/harness/context-mention'

const mentionAppendToken = ref(0)
const pendingMention = ref<ContextMention | null>(null)
const skillAppendToken = ref(0)
const pendingSkill = ref<string | null>(null)
const browserElementAppendToken = ref(0)
const pendingBrowserElement = ref<BrowserElementSelection | null>(null)

const appendMention = (path: string): void => {
  const trimmed = path.trim().replace(/^@/, '')
  if (!trimmed) {
    return
  }
  pendingMention.value = { type: 'file', path: trimmed }
  mentionAppendToken.value += 1
}

const consumePendingMention = (): ContextMention | null => {
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

const appendBrowserElement = (selection: BrowserElementSelection): void => {
  pendingBrowserElement.value = selection
  browserElementAppendToken.value += 1
}

const consumePendingBrowserElement = (): BrowserElementSelection | null => {
  const selection = pendingBrowserElement.value
  pendingBrowserElement.value = null
  return selection
}

export default () => ({
  mentionAppendToken,
  appendMention,
  consumePendingMention,
  skillAppendToken,
  appendSkill,
  consumePendingSkill,
  browserElementAppendToken,
  appendBrowserElement,
  consumePendingBrowserElement,
})
