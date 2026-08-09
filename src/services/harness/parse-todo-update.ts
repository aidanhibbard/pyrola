import type { TodoItem } from '@/types/harness/harness-event'

const parseTodoUpdate = (name: string, result: unknown): TodoItem[] | null => {
  if (name !== 'create_plan' && name !== 'update_plan_todo' && name !== 'write_todos') {
    return null
  }
  if (!result || typeof result !== 'object' || !('todos' in result)) {
    return null
  }
  const todos = (result as { todos: unknown }).todos
  if (!Array.isArray(todos)) {
    return null
  }
  return todos as TodoItem[]
}

export default parseTodoUpdate
