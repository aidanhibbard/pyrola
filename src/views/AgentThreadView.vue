<script setup lang="ts">
import { computed, onMounted, ref, unref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import type { ChatStatus } from 'ai'
import ChatPromptInput from '@/components/chat/ChatPromptInput.vue'
import ChatThread from '@/components/chat/ChatThread.vue'
import ChatTodoTimeline from '@/components/chat/ChatTodoTimeline.vue'
import useAgentHarness from '@/composables/use-agent-harness'
import useChatStore from '@/composables/use-chat-store'
import useFleetRegistry from '@/composables/use-fleet-registry'
import useFleetSidebar from '@/composables/use-fleet-sidebar'
import { consumePendingChatMessage } from '@/services/chat/pending-message'
import { getUserHomeDir } from '@/services/pyrola/pyrola-tauri'
import { HOME_CHAT_SLUG, isHomeChatSlug } from '@/constants/home-chat'
import type { PyrolaChatMode } from '@/types/pyrola/pyrola-settings'

const route = useRoute()
const fleet = useFleetRegistry()
const fleetSidebar = useFleetSidebar()
const chatStore = useChatStore()

const harness = ref<ReturnType<typeof useAgentHarness> | null>(null)
const threadReady = ref(false)
const loadedThreadKey = ref<string | null>(null)
const homeRoot = ref<string | null>(null)

const isStandalone = computed(
  () => route.name === 'home-chat' || isHomeChatSlug(String(route.params.slug ?? '')),
)
const projectSlug = computed(() =>
  isStandalone.value ? HOME_CHAT_SLUG : String(route.params.slug ?? ''),
)
const chatId = computed(() => String(route.params.chatId ?? ''))
const project = computed(
  () => fleet.projects.value.find((item) => item.slug === projectSlug.value) ?? null,
)
const harnessStatus = computed((): ChatStatus => unref(harness.value?.status) ?? 'ready')
const harnessPendingApprovals = computed(
  () => unref(harness.value?.pendingApprovals) ?? [],
)
const pendingQuestion = computed(() => chatStore.pendingQuestion.value)
const timeline = computed(() => chatStore.timeline.value)
const todos = computed(() => chatStore.todos.value)

const initHarness = (root: string, name: string): void => {
  if (!chatId.value) {
    harness.value = null
    return
  }
  harness.value = useAgentHarness({
    projectSlug: projectSlug.value,
    chatId: chatId.value,
    projectRoot: root,
    projectName: name,
    standalone: isStandalone.value,
  })
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

  const pending = consumePendingChatMessage()
  if (pending && harness.value) {
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
}): Promise<void> => {
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
  })
  await fleetSidebar.refreshSlug(projectSlug.value)
}

const handleSubmitEdit = async (payload: {
  text: string
  mode: PyrolaChatMode
  model: string
}): Promise<void> => {
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

const handleStop = (): void => {
  harness.value?.stop()
}

const handleApprove = (toolCallId: string): void => {
  harness.value?.approve(toolCallId)
}

const handleReject = (toolCallId: string): void => {
  harness.value?.reject(toolCallId)
}

const handleSubmitAnswer = (toolCallId: string, answer: string): void => {
  harness.value?.submitAnswer(toolCallId, answer)
}

const handleRetry = async (): Promise<void> => {
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
      :pending-approvals="harnessPendingApprovals"
      :pending-question="pendingQuestion"
      @approve="handleApprove"
      @reject="handleReject"
      @submit-answer="handleSubmitAnswer"
      @retry="handleRetry"
    />
    <div class="shrink-0 px-4 pb-4 pt-2">
      <ChatTodoTimeline
        v-if="todos.length > 0"
        :todos="todos"
        class="mx-auto mb-2 w-full max-w-3xl"
      />
      <ChatPromptInput
        :status="harnessStatus"
        :disabled="!threadReady"
        show-context-usage
        @submit="handleSubmit"
        @submit-edit="handleSubmitEdit"
        @stop="handleStop"
      />
    </div>
  </div>
</template>
