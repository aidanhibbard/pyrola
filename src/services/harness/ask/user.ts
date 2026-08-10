import { tool } from 'ai'
import { z } from 'zod'
import { requestQuestion } from '@/services/harness/permission/question-gate'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const askUser = (ctx: HarnessToolContext) =>
  tool({
    description: 'Ask the user a clarifying question',
    inputSchema: z.object({
      question: z.string(),
      options: z.array(z.string()).optional(),
    }),
    execute: async ({ question, options }, { toolCallId }) => {
      if (ctx.signal?.aborted) {
        throw new Error('Question aborted')
      }
      ctx.onHarnessEvent?.({
        type: 'question-request',
        toolCallId,
        question,
        options,
      })
      const answer = await requestQuestion(ctx.chatId, toolCallId, question, options)
      if (ctx.signal?.aborted) {
        throw new Error('Question aborted')
      }
      return { question, answer, options }
    },
  })

export default askUser
