import { tool } from 'ai'
import { z } from 'zod'
import createPlan from '@/services/plans/write-plan'
import { planTodoItemSchema } from '@/schemas/plan-document'
import { fsWriteFile, updateChatMeta } from '@/services/pyrola/pyrola-tauri'
import useWorkbenchStore from '@/composables/use-workbench-store'
import {
  assertCreatePlanNotAwaitingPlanGo,
  markCreatedPlanThisTurn,
} from '@/services/harness/plan-execution-session'
import withToolExamples from '@/services/harness/with-tool-examples'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const createPlanTool = (ctx: HarnessToolContext) =>
  tool({
    description: withToolExamples(
      'Create a plan file under .pyrola/plans/. After success, stop and wait for the user to click Build now or Orchestrate.',
      [
        {
          title: 'Add harness tool examples',
          body: '## Goal\nSurface usage examples on high-friction tools.\n',
          todos: [
            { id: 'helper', content: 'Add with-tool-examples helper', status: 'pending' },
          ],
        },
      ],
    ),
    inputSchema: z.object({
      title: z.string().describe('Plan title'),
      body: z.string().describe('Markdown plan body'),
      todos: z.array(planTodoItemSchema).optional().describe('Initial todo items'),
    }),
    execute: async ({ title, body, todos }) => {
      assertCreatePlanNotAwaitingPlanGo(ctx.projectSlug, ctx.chatId)
      const planTodos = todos ?? []
      const plan = createPlan({ title, body, todos: planTodos, sourceChatId: ctx.chatId })
      await fsWriteFile({ projectRoot: ctx.projectRoot, path: plan.path, content: plan.content })
      const awaiting = { planPath: plan.path, planId: plan.planId }
      markCreatedPlanThisTurn(ctx.projectSlug, ctx.chatId, awaiting)
      await updateChatMeta(ctx.projectSlug, ctx.chatId, {
        awaitingPlanGo: awaiting,
      })
      const workbench = useWorkbenchStore()
      const projectId = workbench.resolveProjectIdByRoot(ctx.projectRoot)
      if (projectId) {
        workbench.openPlan(projectId, plan.planId, plan.path, title)
      }
      return {
        planId: plan.planId,
        path: plan.path,
        todos: planTodos,
        awaitingGo: true,
        message:
          'Plan created. Stop and wait for the user to click Build now or Orchestrate on the plan tab before making any further changes.',
      }
    },
  })

export default createPlanTool
