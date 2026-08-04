<script setup lang="ts">
import { computed, onMounted, ref, unref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import type { ChatStatus } from 'ai'
import type { ApprovalResolution } from '@/services/harness/approval-gate'
import type { PermissionLevel } from '@/types/harness/permission'
import ChatPromptInput from '@/components/chat/ChatPromptInput.vue'
import ChatThread from '@/components/chat/ChatThread.vue'
import ChatTodoTimeline from '@/components/chat/ChatTodoTimeline.vue'
import RunningTerminalsPanel from '@/components/chat/RunningTerminalsPanel.vue'
import useAgentHarness from '@/composables/use-agent-harness'
import useChatStore from '@/composables/use-chat-store'
import useFleetRegistry from '@/composables/use-fleet-registry'
import useFleetSidebar from '@/composables/use-fleet-sidebar'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import { consumePendingChatMessage } from '@/services/chat/pending-message'
import { getUserHomeDir } from '@/services/pyrola/pyrola-tauri'
import { HOME_CHAT_SLUG, isHomeChatSlug } from '@/constants/home-chat'
import type { PyrolaChatMode } from '@/types/pyrola/pyrola-settings'
import { killAgentShell, listShellsForChat } from '@/services/harness/agent-shell-registry'
import buildSubagentTimeline from '@/utils/build-subagent-timeline'

const route = useRoute()
const fleet = useFleetRegistry()
const fleetSidebar = useFleetSidebar()
const chatStore = useChatStore()
const config = usePyrolaConfig()

const harness = ref<ReturnType<typeof useAgentHarness> | null>(null)
const threadReady = ref(false)
const loadedThreadKey = ref<string | null>(null)
const homeRoot = ref<string | null>(null)
const sessionPermissionLevel = ref<PermissionLevel>(
  config.effectiveSettings.value['agent.permissionLevel'] ?? 'ask',
)
const permissionLevelTouched = ref(false)

const isStandalone = computed(
  () =>
    route.name === 'home-chat' ||
    route.name === 'home-chat-subagent' ||
    isHomeChatSlug(String(route.params.slug ?? '')),
)
const projectSlug = computed(() =>
  isStandalone.value ? HOME_CHAT_SLUG : String(route.params.slug ?? ''),
)
const chatId = computed(() => String(route.params.chatId ?? ''))
const subagentId = computed(() => String(route.params.subagentId ?? ''))
const isSubagentView = computed(() => Boolean(subagentId.value))
const project = computed(
  () => fleet.projects.value.find((item) => item.slug === projectSlug.value) ?? null,
)
const harnessStatus = computed((): ChatStatus => {
  if (isSubagentView.value) {
    const subagent = chatStore.getSubagent(subagentId.value)
    return subagent?.status === 'running' ? 'streaming' : 'ready'
  }
  return unref(harness.value?.status) ?? 'ready'
})
const harnessPendingApprovals = computed(
  () => unref(harness.value?.pendingApprovals) ?? [],
)
const pendingQuestion = computed(() => chatStore.pendingQuestion.value)
const timeline = computed(() => {
  if (!isSubagentView.value) {
    return chatStore.timeline.value
  }
  const subagent = chatStore.getSubagent(subagentId.value)
  if (!subagent) {
    return []
  }
  return buildSubagentTimeline(subagent)
})
const todos = computed(() =>
  isSubagentView.value ? [] : chatStore.todos.value,
)

const runningShells = computed(() => {
  // Touch liveEvents so terminal lifecycle events re-run this computed.
  const liveEventCount = unref(harness.value?.liveEvents)?.length ?? 0
  const shells = listShellsForChat(chatId.value).filter((shell) => shell.status === 'running')
  return liveEventCount < 0 ? [] : shells
})

const activePermissionLevel = computed((): PermissionLevel => {
  return sessionPermissionLevel.value
})

const initHarness = (root: string, name: string): void => {
  if (!chatId.value) {
    harness.value = null
    return
  }
  const nextHarness = useAgentHarness({
    projectSlug: projectSlug.value,
    chatId: chatId.value,
    projectRoot: root,
    projectName: name,
    standalone: isStandalone.value,
  })
  harness.value = nextHarness
  nextHarness.setPermissionLevel(sessionPermissionLevel.value)
}

const loadThread = async (): Promise<void> => {
  if (!chatId.value || !fleet.loaded.value) {
    return
  }
  if (!isStandalone.value && !projectSlug.value) {
    return
  }

  const threadKey = `${projectSlug.value}:${chatId.value}`
  if (loadedThreadKey.value === threadKey && harness.value) {
    return
  }

  threadReady.value = false

  if (isStandalone.value) {
    if (!homeRoot.value) {
      homeRoot.value = await getUserHomeDir()
    }
    await chatStore.loadChat(HOME_CHAT_SLUG, chatId.value)
    initHarness(homeRoot.value, 'Home')
  } else {
    if (!project.value) {
      toast.error('Project not found', {
        description: `No project registered for slug "${projectSlug.value}"`,
      })
      return
    }
    await fleet.setActiveProject(project.value.id)
    await chatStore.loadChat(projectSlug.value, chatId.value)
    initHarness(project.value.rootPath, project.value.name)
  }

  await fleetSidebar.refreshSlug(projectSlug.value)
  loadedThreadKey.value = threadKey
  threadReady.value = true

  if (isSubagentView.value) {
    return
  }

  const pending = consumePendingChatMessage()
  if (pending && harness.value) {
    if (pending.permissionLevel) {
      permissionLevelTouched.value = true
      sessionPermissionLevel.value = pending.permissionLevel
      harness.value.setPermissionLevel(pending.permissionLevel)
    }
    await harness.value.send({
      text: pending.text,
      mode: pending.mode,
      model: pending.model,
    })
    await fleetSidebar.refreshSlug(projectSlug.value)
  }
}

const handleSubmit = async (payload: {
  text: string
  mode: PyrolaChatMode
  model: string
  files?: import('ai').FileUIPart[]
}): Promise<void> => {
  if (isSubagentView.value) {
    return
  }
  if (!payload.model) {
    toast.error('Select a model before sending')
    return
  }
  if (!harness.value) {
    toast.error('Chat is not ready yet', {
      description: 'Wait for the chat to finish loading.',
    })
    return
  }
  await harness.value.send({
    text: payload.text,
    mode: payload.mode,
    model: payload.model,
    files: payload.files,
  })
  await fleetSidebar.refreshSlug(projectSlug.value)
}

const handleSubmitEdit = async (payload: {
  text: string
  mode: PyrolaChatMode
  model: string
}): Promise<void> => {
  if (isSubagentView.value) {
    return
  }
  if (!harness.value) {
    toast.error('Chat is not ready yet', {
      description: 'Wait for the chat to finish loading.',
    })
    return
  }
  await harness.value.submitEditMessage({
    newContent: payload.text,
    mode: payload.mode,
    model: payload.model,
  })
  await fleetSidebar.refreshSlug(projectSlug.value)
}

const handleStop = async (): Promise<void> => {
  if (isSubagentView.value) {
    return
  }
  try {
    await harness.value?.stop()
  } catch (error) {
    toast.error('Failed to stop agent', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const handleStopSubagent = (subagentId: string): void => {
  harness.value?.stopSubagent(subagentId)
}

const handleKillShell = async (shellId: string): Promise<void> => {
  try {
    await killAgentShell(shellId)
  } catch (error) {
    toast.error('Failed to stop terminal', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const handleResolveApproval = (toolCallId: string, resolution: ApprovalResolution): void => {
  harness.value?.resolveApprovalDecision(toolCallId, resolution)
}

const handleSubmitAnswer = (toolCallId: string, answer: string): void => {
  harness.value?.submitAnswer(toolCallId, answer)
}

const handleRetry = async (): Promise<void> => {
  if (isSubagentView.value) {
    return
  }
  if (!harness.value) {
    toast.error('Chat is not ready yet', {
      description: 'Wait for the chat to finish loading.',
    })
    return
  }
  const model = chatStore.meta.value?.model
  const mode = chatStore.meta.value?.mode ?? 'agent'
  if (!model) {
    toast.error('Select a model before retrying')
    return
  }
  await harness.value.retryLastTurn({
    mode,
    model,
  })
}

const handlePermissionLevelChange = (level: PermissionLevel): void => {
  permissionLevelTouched.value = true
  sessionPermissionLevel.value = level
  harness.value?.setPermissionLevel(level)
}

const handleCompact = async (): Promise<void> => {
  if (isSubagentView.value) {
    return
  }
  if (!harness.value) {
    toast.error('Chat is not ready yet')
    return
  }
  await harness.value.compactChat()
}

const handleHandoff = async (): Promise<void> => {
  if (isSubagentView.value) {
    return
  }
  if (!harness.value) {
    toast.error('Chat is not ready yet')
    return
  }
  await harness.value.createHandoff()
}

watch(
  () => config.hydrated.value,
  (hydrated) => {
    if (!hydrated || permissionLevelTouched.value) {
      return
    }
    sessionPermissionLevel.value =
      config.effectiveSettings.value['agent.permissionLevel'] ?? 'ask'
    harness.value?.setPermissionLevel(sessionPermissionLevel.value)
  },
  { immediate: true },
)

onMounted(() => {
  loadThread().catch((error) => {
    toast.error('Failed to load chat', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  })
})

watch([projectSlug, chatId, () => fleet.loaded.value, isStandalone], () => {
  loadThread().catch((error) => {
    toast.error('Failed to load chat', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  })
})
</script>

<template>
  <div class="relative flex h-full min-h-0 flex-col">
    <ChatThread
      class="min-h-0 flex-1"
      :timeline="timeline"
      :status="harnessStatus"
      :pending-approvals="isSubagentView ? [] : harnessPendingApprovals"
      :pending-question="isSubagentView ? null : pendingQuestion"
      :read-only="isSubagentView"
      @resolve-approval="handleResolveApproval"
      @submit-answer="handleSubmitAnswer"
      @retry="handleRetry"
      @stop-subagent="handleStopSubagent"
    />
    <div
      v-if="!isSubagentView"
      class="shrink-0 px-4 pb-4 pt-2"
    >
      <ChatTodoTimeline
        v-if="todos.length > 0"
        :todos="todos"
        class="mx-auto mb-2 w-full max-w-3xl"
      />
      <RunningTerminalsPanel
        :shells="runningShells"
        @stop-shell="handleKillShell"
      />
      <ChatPromptInput
        :status="harnessStatus"
        :disabled="!threadReady"
        show-context-usage
        :permission-level="activePermissionLevel"
        :on-compact="handleCompact"
        :on-handoff="handleHandoff"
        @submit="handleSubmit"
        @submit-edit="handleSubmitEdit"
        @stop="handleStop"
        @update:permission-level="handlePermissionLevelChange"
      />
    </div>
  </div>
</template>
