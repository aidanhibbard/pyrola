<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, unref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import type { ChatStatus } from 'ai'
import type { ApprovalResolution } from '@/services/harness/approval-gate'
import type { PermissionLevel } from '@/types/harness/permission'
import ChatPromptInput from '@/components/chat/ChatPromptInput.vue'
import ChatThread from '@/components/chat/ChatThread.vue'
import ChatTodoTimeline from '@/components/chat/ChatTodoTimeline.vue'
import RunningTerminalsPanel from '@/components/chat/RunningTerminalsPanel.vue'
import ChatContextUsageBar from '@/components/chat/ContextUsageBar.vue'
import useAgentHarness from '@/composables/use-agent-harness'
import useChatStore from '@/composables/use-chat-store'
import useChatContextActions from '@/composables/use-chat-context-actions'
import useChatContextBudgetSync from '@/composables/use-chat-context-budget-sync'
import useFleetRegistry from '@/composables/use-fleet-registry'
import useFleetSidebar from '@/composables/use-fleet-sidebar'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import useMcpServers from '@/composables/use-mcp-servers'
import useWorkbenchStore from '@/composables/use-workbench-store'
import { consumePendingChatMessage, PENDING_CHAT_MESSAGE_EVENT } from '@/services/chat/pending-message'
import {
  clearAwaitingPlanGo,
  setSubagentModelLock,
} from '@/services/harness/plan-execution-session'
import { getUserHomeDir, updateChatMeta } from '@/services/pyrola/pyrola-tauri'
import { HOME_CHAT_SLUG, isHomeChatSlug } from '@/constants/home-chat'
import type { PyrolaChatMode } from '@/types/pyrola/pyrola-settings'
import type { ReasoningLevel } from '@/types/models/reasoning-level'
import { isReasoningLevel } from '@/types/models/reasoning-level'
import { killAgentShell, listShellsForChat } from '@/services/harness/agent-shell-registry'
import buildSubagentTimeline from '@/utils/build-subagent-timeline'

const route = useRoute()
const router = useRouter()
const fleet = useFleetRegistry()
const fleetSidebar = useFleetSidebar()
const chatStore = useChatStore()
const config = usePyrolaConfig()
const {
  personalMcp: mcpPersonalConfig,
  projectMcp: mcpProjectConfig,
} = useMcpServers()
const contextActions = useChatContextActions()
const workbench = useWorkbenchStore()
const contextBudgetSync = useChatContextBudgetSync()

const harness = ref<ReturnType<typeof useAgentHarness> | null>(null)
const threadReady = ref(false)
const loadedThreadKey = ref<string | null>(null)
const homeRoot = ref<string | null>(null)
const sessionPermissionLevel = ref<PermissionLevel>(
  config.effectiveSettings.value['agent.permissionLevel'] ?? 'allowlist',
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
  const status = unref(harness.value?.status) ?? 'ready'
  if (status === 'streaming' || status === 'submitted') {
    return status
  }
  const hasRunningSubagent = chatStore.timeline.value.some(
    (item) => item.type === 'subagent' && item.status === 'running',
  )
  return hasRunningSubagent ? 'streaming' : status
})
const harnessPendingApprovals = computed(
  () => unref(harness.value?.pendingApprovals) ?? [],
)
const harnessPendingMcpAuth = computed(
  () => unref(harness.value?.pendingMcpAuth) ?? [],
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
  nextHarness.restorePendingApprovals()
}

const flushPendingChatMessage = async (): Promise<void> => {
  if (isSubagentView.value) {
    return
  }
  if (!harness.value) {
    return
  }

  const pending = consumePendingChatMessage()
  if (!pending) {
    return
  }

  if (pending.permissionLevel) {
    permissionLevelTouched.value = true
    sessionPermissionLevel.value = pending.permissionLevel
    harness.value.setPermissionLevel(pending.permissionLevel)
  }

  if (pending.subagentModel) {
    const subagentReasoning = isReasoningLevel(pending.subagentReasoning)
      ? pending.subagentReasoning
      : null
    setSubagentModelLock(
      projectSlug.value,
      chatId.value,
      pending.subagentModel,
      subagentReasoning,
    )
    try {
      await updateChatMeta(projectSlug.value, chatId.value, {
        subagentModel: pending.subagentModel,
        subagentReasoning,
        reasoning: isReasoningLevel(pending.reasoning) ? pending.reasoning : null,
        awaitingPlanGo: null,
      })
    } catch (error) {
      toast.error('Failed to update chat for plan build', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  } else {
    clearAwaitingPlanGo(projectSlug.value, chatId.value)
  }

  await harness.value.send({
    text: pending.text,
    mode: pending.mode,
    model: pending.model,
    reasoning: isReasoningLevel(pending.reasoning) ? pending.reasoning : undefined,
  })
  await fleetSidebar.refreshSlug(projectSlug.value)
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
    harness.value.restorePendingApprovals()
    await flushPendingChatMessage()
    return
  }

  const alreadyWarm = chatStore.isSessionWarm(projectSlug.value, chatId.value)

  // Warm sessions keep the previous thread visible until swap completes.
  if (!alreadyWarm) {
    threadReady.value = false
  }

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

  await contextBudgetSync.refreshContextBudget().catch((error) => {
    toast.error('Failed to refresh context usage', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  })

  await flushPendingChatMessage()
}

const handleSubmit = async (payload: {
  text: string
  mode: PyrolaChatMode
  model: string
  reasoning?: ReasoningLevel
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
    reasoning: payload.reasoning,
    files: payload.files,
  })
  await fleetSidebar.refreshSlug(projectSlug.value)
}

const handleSubmitEdit = async (payload: {
  text: string
  mode: PyrolaChatMode
  model: string
  reasoning?: ReasoningLevel
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
    reasoning: payload.reasoning,
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

const handleAuthenticateMcp = async (toolCallId: string): Promise<void> => {
  try {
    await harness.value?.authenticatePendingMcpAuth(toolCallId)
  } catch (error) {
    toast.error('MCP authentication failed', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const handleSecretsSavedMcp = async (toolCallId: string): Promise<void> => {
  try {
    await harness.value?.authenticatePendingMcpAuth(toolCallId)
  } catch (error) {
    toast.error('MCP authentication failed', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const handleSkipMcpAuth = (toolCallId: string): void => {
  harness.value?.resolveMcpAuthDecision(toolCallId, { action: 'skipped' })
}

const handleOpenMcpSettings = async (serverId: string): Promise<void> => {
  try {
    await router.push({
      path: '/settings',
      query: {
        section: 'mcp',
        server: serverId,
      },
    })
  } catch (error) {
    toast.error('Navigation failed', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
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
  [harnessStatus, threadReady, isSubagentView],
  () => {
    if (isSubagentView.value) {
      contextActions.clear()
      return
    }
    contextActions.register({
      onCompact: () => {
        handleCompact().catch((error) => {
          toast.error('Failed to compact chat', {
            description: error instanceof Error ? error.message : 'Unknown error',
          })
        })
      },
      onHandoff: () => {
        handleHandoff().catch((error) => {
          toast.error('Failed to hand off chat', {
            description: error instanceof Error ? error.message : 'Unknown error',
          })
        })
      },
    })
    contextActions.setDisabled({
      triggerDisabled: !threadReady.value,
      actionsDisabled:
        !threadReady.value ||
        harnessStatus.value === 'streaming' ||
        harnessStatus.value === 'submitted',
    })
  },
  { immediate: true },
)

watch(
  () => config.hydrated.value,
  (hydrated) => {
    if (!hydrated || permissionLevelTouched.value) {
      return
    }
    sessionPermissionLevel.value =
      config.effectiveSettings.value['agent.permissionLevel'] ?? 'allowlist'
    harness.value?.setPermissionLevel(sessionPermissionLevel.value)
  },
  { immediate: true },
)

let removePendingListener: (() => void) | null = null

onMounted(() => {
  const handlePendingMessageEvent = (): void => {
    flushPendingChatMessage().catch((error) => {
      toast.error('Failed to start plan build', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    })
  }
  window.addEventListener(PENDING_CHAT_MESSAGE_EVENT, handlePendingMessageEvent)
  removePendingListener = () => {
    window.removeEventListener(PENDING_CHAT_MESSAGE_EVENT, handlePendingMessageEvent)
  }

  loadThread().catch((error) => {
    toast.error('Failed to load chat', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  })
})

onUnmounted(() => {
  removePendingListener?.()
  removePendingListener = null
  contextActions.clear()
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
    <!--
      Always host the ring on the chat column titlebar band. Parent main uses
      pt-(--titlebar-height). z-51 sits above the titlebar drag region; the
      sidebar trigger uses z-52 so it stays clickable when the workbench is closed.
    -->
    <div
      v-if="contextActions.available.value"
      class="pointer-events-none absolute inset-x-0 top-0 z-[51] flex h-(--titlebar-height) -translate-y-full items-center justify-end"
      :class="workbench.rightSidebarOpen.value ? 'pr-2' : 'pr-12'"
      style="--titlebar-height: 40px"
    >
      <div class="pointer-events-auto" data-tauri-drag-region="false">
        <ChatContextUsageBar />
      </div>
    </div>
    <ChatThread
      class="min-h-0 flex-1"
      :timeline="timeline"
      :status="harnessStatus"
      :pending-approvals="isSubagentView ? [] : harnessPendingApprovals"
      :pending-question="isSubagentView ? null : pendingQuestion"
      :pending-mcp-auth="isSubagentView ? [] : harnessPendingMcpAuth"
      :personal-mcp="mcpPersonalConfig"
      :project-mcp="mcpProjectConfig"
      :read-only="isSubagentView"
      @resolve-approval="handleResolveApproval"
      @submit-answer="handleSubmitAnswer"
      @authenticate-mcp="handleAuthenticateMcp"
      @skip-mcp-auth="handleSkipMcpAuth"
      @open-mcp-settings="handleOpenMcpSettings"
      @secrets-saved-mcp="(toolCallId) => handleSecretsSavedMcp(toolCallId)"
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
        :permission-level="activePermissionLevel"
        @submit="handleSubmit"
        @submit-edit="handleSubmitEdit"
        @stop="handleStop"
        @update:permission-level="handlePermissionLevelChange"
      />
    </div>
  </div>
</template>
