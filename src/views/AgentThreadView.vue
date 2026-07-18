<script setup lang="ts">
import { computed, onMounted, ref, unref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import type { ChatStatus } from 'ai'
import ChatPromptInput from '@/components/chat/ChatPromptInput.vue'
import ChatChatBreadcrumbs from '@/components/chat/ChatBreadcrumbs.vue'
import ChatThread from '@/components/chat/ChatThread.vue'
import useAgentHarness from '@/composables/use-agent-harness'
import useChatStore from '@/composables/use-chat-store'
import useFleetRegistry from '@/composables/use-fleet-registry'
import useFleetSidebar from '@/composables/use-fleet-sidebar'
import { consumePendingChatMessage } from '@/services/chat/pending-message'
import type { PyrolaChatMode } from '@/types/pyrola/pyrola-settings'

const route = useRoute()
const fleet = useFleetRegistry()
const fleetSidebar = useFleetSidebar()
const chatStore = useChatStore()

const harness = ref<ReturnType<typeof useAgentHarness> | null>(null)
const threadReady = ref(false)
const loadedThreadKey = ref<string | null>(null)

const projectSlug = computed(() => String(route.params.slug ?? ''))
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

const initHarness = (): void => {
  if (!project.value || !chatId.value) {
    harness.value = null
    return
  }
  harness.value = useAgentHarness({
    projectSlug: projectSlug.value,
    chatId: chatId.value,
    projectRoot: project.value.rootPath,
    projectName: project.value.name,
  })
}

const loadThread = async (): Promise<void> => {
  if (!projectSlug.value || !chatId.value || !fleet.loaded.value) {
    return
  }

  const threadKey = `${projectSlug.value}:${chatId.value}`
  if (loadedThreadKey.value === threadKey && harness.value) {
    return
  }

  if (!project.value) {
    toast.error('Project not found', {
      description: `No project registered for slug "${projectSlug.value}"`,
    })
    return
  }

  threadReady.value = false
  await chatStore.loadChat(projectSlug.value, chatId.value)
  initHarness()
  await fleetSidebar.refreshAll()
  loadedThreadKey.value = threadKey
  threadReady.value = true

  const pending = consumePendingChatMessage()
  if (pending && harness.value) {
    await harness.value.send({
      text: pending.text,
      mode: pending.mode,
      model: pending.model,
    })
    await fleetSidebar.refreshAll()
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
      description: 'Wait for the project to finish loading.',
    })
    return
  }
  await harness.value.send({
    text: payload.text,
    mode: payload.mode,
    model: payload.model,
  })
  await fleetSidebar.refreshAll()
}

const handleSubmitEdit = async (payload: {
  text: string
  mode: PyrolaChatMode
  model: string
}): Promise<void> => {
  if (!harness.value) {
    toast.error('Chat is not ready yet', {
      description: 'Wait for the project to finish loading.',
    })
    return
  }
  await harness.value.submitEditMessage({
    newContent: payload.text,
    mode: payload.mode,
    model: payload.model,
  })
  await fleetSidebar.refreshAll()
}

const handleReset = async (payload: {
  mode: PyrolaChatMode
  model: string
}): Promise<void> => {
  if (!harness.value) {
    toast.error('Chat is not ready yet', {
      description: 'Wait for the project to finish loading.',
    })
    return
  }
  await harness.value.resetToLastQuestion({
    mode: payload.mode,
    model: payload.model,
  })
  await fleetSidebar.refreshAll()
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

onMounted(() => {
  loadThread().catch((error) => {
    toast.error('Failed to load chat', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  })
})

watch([projectSlug, chatId, () => fleet.loaded.value], () => {
  loadThread().catch((error) => {
    toast.error('Failed to load chat', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  })
})
</script>

<template>
  <div class="relative flex h-full min-h-0 flex-col">
    <div
      class="pointer-events-none absolute inset-x-0 top-0 z-40 flex h-(--titlebar-height) -translate-y-full items-center"
      style="--titlebar-height: 40px"
    >
      <div class="pointer-events-auto mx-auto flex w-full min-w-0 max-w-3xl px-4">
        <ChatChatBreadcrumbs class="min-w-0 flex-1" />
      </div>
    </div>
    <ChatThread
      class="min-h-0 flex-1"
      :timeline="timeline"
      :status="harnessStatus"
      :pending-approvals="harnessPendingApprovals"
      :pending-question="pendingQuestion"
      @approve="handleApprove"
      @reject="handleReject"
      @submit-answer="handleSubmitAnswer"
    />
    <div class="shrink-0 px-4 pb-4 pt-2">
      <ChatPromptInput
        :status="harnessStatus"
        :disabled="!threadReady"
        show-context-usage
        @submit="handleSubmit"
        @submit-edit="handleSubmitEdit"
        @reset="handleReset"
        @stop="handleStop"
      />
    </div>
  </div>
</template>
