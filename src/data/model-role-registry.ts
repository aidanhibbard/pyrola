import type { SideTaskKind } from '@/types/harness/side-task-kind'
import type { PyrolaChatMode } from '@/types/pyrola/pyrola-settings'

export type ModelRoleGroup = 'general' | 'chatModes' | 'backgroundTasks'

export type ModelRoleId =
  | 'default'
  | PyrolaChatMode
  | 'title'
  | 'compaction'

export type ModelRoleDefinition = {
  id: ModelRoleId
  settingsKey: `models.${string}`
  label: string
  description: string
  group: ModelRoleGroup
  sideTaskKind?: SideTaskKind
}

export const MODEL_ROLE_GROUP_LABELS: Record<ModelRoleGroup, string> = {
  general: 'General',
  chatModes: 'Chat modes',
  backgroundTasks: 'Background tasks',
}

export const MODEL_ROLE_REGISTRY: ModelRoleDefinition[] = [
  {
    id: 'default',
    settingsKey: 'models.default',
    label: 'Default model',
    description: 'Fallback for all roles unless a specific override is set.',
    group: 'general',
  },
  {
    id: 'ask',
    settingsKey: 'models.ask',
    label: 'Ask',
    description: 'Default model for Ask mode chats.',
    group: 'chatModes',
  },
  {
    id: 'plan',
    settingsKey: 'models.plan',
    label: 'Plan',
    description: 'Default model for Plan mode chats.',
    group: 'chatModes',
  },
  {
    id: 'studio',
    settingsKey: 'models.studio',
    label: 'Studio',
    description: 'Default model for Studio mode chats.',
    group: 'chatModes',
  },
  {
    id: 'agent',
    settingsKey: 'models.agent',
    label: 'Agent',
    description: 'Default model for Agent mode chats and single-agent plan execution.',
    group: 'chatModes',
  },
  {
    id: 'orchestrator',
    settingsKey: 'models.orchestrator',
    label: 'Orchestrator',
    description: 'Default model for Orchestrator mode chats and plan orchestration.',
    group: 'chatModes',
  },
  {
    id: 'title',
    settingsKey: 'models.title',
    label: 'Conversation naming',
    description: 'Generates short titles for new chats.',
    group: 'backgroundTasks',
    sideTaskKind: 'generate-chat-title',
  },
  {
    id: 'compaction',
    settingsKey: 'models.compaction',
    label: 'Context compaction',
    description: 'Summarizes conversation history when context limits are reached.',
    group: 'backgroundTasks',
  },
]

export const CHAT_MODE_MODEL_ROLES = MODEL_ROLE_REGISTRY.filter(
  (role) => role.group === 'chatModes',
)

export const BACKGROUND_MODEL_ROLES = MODEL_ROLE_REGISTRY.filter(
  (role) => role.group === 'backgroundTasks',
)
