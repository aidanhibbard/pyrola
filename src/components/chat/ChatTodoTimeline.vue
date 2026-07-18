<script setup lang="ts">
import { computed } from 'vue'
import {
  CheckCircle2Icon,
  CircleDashedIcon,
  CircleDotIcon,
  CircleIcon,
  XCircleIcon,
} from '@lucide/vue'
import type { TodoItem } from '@/types/harness/harness-event'
import {
  Task,
  TaskContent,
  TaskItem,
  TaskTrigger,
} from '@/components/ai-elements/task'
import { cn } from '@/lib/utils'

const props = defineProps<{
  todos: TodoItem[]
}>()

const completedCount = computed(
  () => props.todos.filter((todo) => todo.status === 'completed').length,
)

const triggerTitle = computed(() => {
  if (props.todos.length === 0) {
    return 'Tasks'
  }
  return `Tasks (${completedCount.value}/${props.todos.length})`
})

const statusIcon = (status: TodoItem['status']) => {
  if (status === 'completed') {
    return CheckCircle2Icon
  }
  if (status === 'in_progress') {
    return CircleDotIcon
  }
  if (status === 'cancelled') {
    return XCircleIcon
  }
  if (status === 'pending') {
    return CircleDashedIcon
  }
  return CircleIcon
}

const statusClass = (status: TodoItem['status']): string => {
  if (status === 'completed') {
    return 'text-emerald-500'
  }
  if (status === 'in_progress') {
    return 'text-primary'
  }
  if (status === 'cancelled') {
    return 'text-muted-foreground line-through'
  }
  return 'text-muted-foreground'
}
</script>

<template>
  <Task class="not-prose w-full min-w-0">
    <TaskTrigger :title="triggerTitle" />
    <TaskContent>
      <TaskItem
        v-for="todo in todos"
        :key="todo.id"
        class="flex items-start gap-2"
      >
        <component
          :is="statusIcon(todo.status)"
          class="mt-0.5 size-4 shrink-0"
          :class="statusClass(todo.status)"
        />
        <span :class="cn('min-w-0 flex-1', statusClass(todo.status))">
          {{ todo.content }}
        </span>
      </TaskItem>
    </TaskContent>
  </Task>
</template>
