import { toast } from 'vue-sonner'
import type { ApprovalResolution } from '@/services/harness/permission/approval-gate'
import { HOME_WORKSPACE_ID } from '@/constants/home-chat'
import { killAgentShell } from '@/services/harness/shell/registry'
import type { AgentThreadViewState } from './types'

export const createShellMcpHandlers = (state: AgentThreadViewState) => {
  const handleQueueForce = async (id: string): Promise<void> => {
    if (!state.harness.value) {
      return
    }
    try {
      await state.harness.value.forceSendQueued(id)
    } catch (error) {
      toast.error('Failed to send queued message', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const handleQueueRemove = (id: string): void => {
    state.harness.value?.cancelQueued(id)
  }

  const handleQueueEdit = async (id: string): Promise<void> => {
    if (!state.harness.value) {
      return
    }
    const item = state.harness.value.editQueued(id)
    if (!item) {
      return
    }
    try {
      await state.chatPromptInputRef.value?.hydrateQueuedMessage(item)
      state.harness.value.cancelQueued(id)
    } catch (error) {
      toast.error('Failed to load message for editing', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
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

  const handleOpenShell = (shellId: string): void => {
    const projectId = state.isStandalone.value
      ? HOME_WORKSPACE_ID
      : state.project.value?.id
    if (!projectId) {
      toast.error('Project not found', {
        description: 'Could not resolve the active project for this chat.',
      })
      return
    }

    try {
      state.workbench.openAgentShell(projectId, shellId)
    } catch (error) {
      toast.error('Failed to open terminal', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const handleResolveApproval = (
    toolCallId: string,
    resolution: ApprovalResolution,
  ): void => {
    state.harness.value?.resolveApprovalDecision(toolCallId, resolution)
  }

  const handleSubmitAnswer = (toolCallId: string, answer: string): void => {
    state.harness.value?.submitAnswer(toolCallId, answer)
  }

  const handleAuthenticateMcp = async (toolCallId: string): Promise<void> => {
    try {
      await state.harness.value?.authenticatePendingMcpAuth(toolCallId)
    } catch (error) {
      toast.error('MCP authentication failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const handleSecretsSavedMcp = async (toolCallId: string): Promise<void> => {
    try {
      await state.harness.value?.authenticatePendingMcpAuth(toolCallId)
    } catch (error) {
      toast.error('MCP authentication failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const handleSkipMcpAuth = (toolCallId: string): void => {
    state.harness.value?.resolveMcpAuthDecision(toolCallId, { action: 'skipped' })
  }

  const handleOpenMcpSettings = async (serverId: string): Promise<void> => {
    try {
      await state.router.push({
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

  return {
    handleQueueForce,
    handleQueueRemove,
    handleQueueEdit,
    handleKillShell,
    handleOpenShell,
    handleResolveApproval,
    handleSubmitAnswer,
    handleAuthenticateMcp,
    handleSecretsSavedMcp,
    handleSkipMcpAuth,
    handleOpenMcpSettings,
  }
}
