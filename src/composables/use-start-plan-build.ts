import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import useChatStore from '@/composables/use-chat-store'
import useFleetRegistry from '@/composables/use-fleet-registry'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import { refreshFleetSidebar } from '@/composables/use-fleet-sidebar'
import resolveModelForRole from '@/services/models/resolve-model-for-role'
import loadPrompt from '@/services/prompts/load-prompt'
import { setPendingChatMessage } from '@/services/chat/pending-message'
import updatePlanFrontmatter from '@/services/plans/update-plan-frontmatter'
import { readChatMeta, updateChatMeta } from '@/services/pyrola/pyrola-tauri'
import type { PyrolaChatMode } from '@/types/pyrola/pyrola-settings'

export type PlanExecutionMode = 'agent' | 'orchestrator'

export type StartPlanBuildInput = {
  projectId: string
  planPath: string
  planTitle: string
  sourceChatId?: string | null
  model?: string
  executionMode?: PlanExecutionMode
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

  const startPlanBuild = async (input: StartPlanBuildInput): Promise<boolean> => {
    if (building.value) {
      return false
    }

    const project = fleet.projects.value.find((item) => item.id === input.projectId)
    if (!project) {
      toast.error('Project not found')
      return false
    }

    const executionMode = input.executionMode ?? 'agent'
    const modelRole = executionMode === 'orchestrator' ? 'orchestrator' : 'agent'
    const chatMode: PyrolaChatMode =
      executionMode === 'orchestrator' ? 'orchestrator' : 'agent'
    const model =
      input.model?.trim() ||
      resolveModelForRole(modelRole, config.effectiveSettings.value) ||
      ''
    if (!model) {
      toast.error('Select a default model in Settings before building')
      return false
    }

    const promptPath =
      executionMode === 'orchestrator'
        ? 'handoffs/plan-orchestrate.md'
        : 'handoffs/plan-build.md'
    const prompt = loadPrompt(promptPath, {
      planPath: input.planPath,
      planTitle: input.planTitle,
    })

    building.value = true
    try {
      await fleet.setActiveProject(project.id)

      let chatId = await resolveExistingChatId(project.slug, input.sourceChatId)
      if (!chatId) {
        const chat = await chatStore.createNewChat({
          projectSlug: project.slug,
          projectRoot: project.rootPath,
          mode: chatMode,
          model,
          title: input.planTitle,
        })
        chatId = chat.id
      } else {
        const meta = await readChatMeta(project.slug, chatId)
        const patch: { model?: string; mode?: PyrolaChatMode } = {}
        if (meta.model !== model) {
          patch.model = model
        }
        if (meta.mode !== chatMode) {
          patch.mode = chatMode
        }
        if (Object.keys(patch).length > 0) {
          await updateChatMeta(project.slug, chatId, patch)
        }
      }

      setPendingChatMessage({
        text: prompt,
        mode: chatMode,
        model,
      })

      await updatePlanFrontmatter({
        projectRoot: project.rootPath,
        path: input.planPath,
        patch: {
          builtAt: new Date().toISOString(),
          lastBuildChatId: chatId,
          lastBuildModel: model,
        },
      })

      await refreshFleetSidebar()
      await router.push(`/project/${project.slug}/chat/${chatId}`)
      return true
    } catch (error) {
      toast.error('Could not start plan build', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
      return false
    } finally {
      building.value = false
    }
  }

  return {
    building,
    startPlanBuild,
  }
}
