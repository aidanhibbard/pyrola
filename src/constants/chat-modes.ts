import {
  BarChart3Icon,
  BotIcon,
  CircleHelpIcon,
  ListTodoIcon,
  NetworkIcon,
} from '@lucide/vue'
import type { Component } from 'vue'
import type { PyrolaChatMode } from '@/types/pyrola/pyrola-settings'

export type ChatModeMeta = {
  value: PyrolaChatMode
  label: string
  icon: Component
}

export const CHAT_MODES: ChatModeMeta[] = [
  { value: 'ask', label: 'Ask', icon: CircleHelpIcon },
  { value: 'plan', label: 'Plan', icon: ListTodoIcon },
  { value: 'studio', label: 'Studio', icon: BarChart3Icon },
  { value: 'agent', label: 'Agent', icon: BotIcon },
  { value: 'orchestrator', label: 'Orchestrator', icon: NetworkIcon },
]

export const getChatModeMeta = (mode: PyrolaChatMode): ChatModeMeta =>
  CHAT_MODES.find((entry) => entry.value === mode) ?? CHAT_MODES[3]!
