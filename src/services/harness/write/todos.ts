import { tool } from 'ai'
import { z } from 'zod'
import { planTodoItemSchema } from '@/schemas/plan-document'
import withToolExamples from '@/services/harness/with-tool-examples'
const writeTodos = () =>
  tool({
    description: withToolExamples(
      'Replace the in-chat todo list shown in Tasks. Full-array replace; does not create a plan file.',
      [
        {
          todos: [
            {
              id: 'review',
              content: 'Review harness tool wiring',
              status: 'completed',
            },
            {
              id: 'implement',
              content: 'Add write_todos tool',
              status: 'in_progress',
            },
            {
              id: 'tests',
              content: 'Cover write_todos in tests',
              status: 'pending',
            },
          ],
        },
      ],
    ),
    inputSchema: z.object({
      todos: z.array(planTodoItemSchema).describe('Full todo list to show in chat Tasks'),
    }),
    execute: async ({ todos }) => {
      const normalized = z.array(planTodoItemSchema).parse(todos)
      return { todos: normalized }
    },
  })

export default writeTodos
