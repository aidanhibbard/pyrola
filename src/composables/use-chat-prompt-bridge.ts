import { ref } from 'vue'

const mentionAppendToken = ref(0)
const pendingMention = ref<string | null>(null)
const skillAppendToken = ref(0)
const pendingSkill = ref<string | null>(null)

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

export default () => ({
  mentionAppendToken,
  appendMention,
  consumePendingMention,
  skillAppendToken,
  appendSkill,
  consumePendingSkill,
})
