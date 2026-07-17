import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import useChatStore from '@/composables/use-chat-store'
import useFleetRegistry from '@/composables/use-fleet-registry'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import { refreshFleetSidebar } from '@/composables/use-fleet-sidebar'
import { setPendingChatMessage } from '@/services/chat/pending-message'
import { readChatMeta } from '@/services/pyrola/pyrola-tauri'

export type StartPlanBuildInput = {
  projectId: string
  planPath: string
  planTitle: string
  sourceChatId?: string | null
}

export default () => {
  const router = useRouter()
  const fleet = useFleetRegistry()
  const chatStore = useChatStore()
  const config = usePyrolaConfig()
  const building = ref(false)

  const resolveExistingChatId = async (
    projectSlug: string,
    sourceChatId: string | null | undefined,
  ): Promise<string | null> => {
    if (!sourceChatId) {
      return null
    }

    try {
      await readChatMeta(projectSlug, sourceChatId)
      return sourceChatId
    } catch {
      return null
    }
  }

  const startPlanBuild = async (input: StartPlanBuildInput): Promise<void> => {
    if (building.value) {
      return
    }

    const project = fleet.projects.value.find((item) => item.id === input.projectId)
    if (!project) {
      toast.error('Project not found')
      return
    }

    const model = config.effectiveSettings.value['agent.defaultModel'] ?? ''
    if (!model) {
      toast.error('Select a default model in Settings before building')
      return
    }

    const prompt = `Execute the plan in \`${input.planPath}\` (${input.planTitle}). Read the plan, work through its todos, and implement the changes.`

    building.value = true
    try {
      await fleet.setActiveProject(project.id)

      let chatId = await resolveExistingChatId(project.slug, input.sourceChatId)
      if (!chatId) {
        const chat = await chatStore.createNewChat({
          projectSlug: project.slug,
          projectRoot: project.rootPath,
          mode: 'agent',
          model,
          title: input.planTitle,
        })
        chatId = chat.id
      }

      setPendingChatMessage({
        text: prompt,
        mode: 'agent',
        model,
      })
      await refreshFleetSidebar()
      await router.push(`/project/${project.slug}/chat/${chatId}`)
    } catch (error) {
      toast.error('Could not start plan build', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      building.value = false
    }
  }

  return {
    building,
    startPlanBuild,
  }
}
