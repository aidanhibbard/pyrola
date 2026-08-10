<script setup lang="ts">
import AgentCreateForm from '@/components/settings/pyrola-files/AgentCreateForm.vue'
import PlanCreateForm from '@/components/settings/pyrola-files/PlanCreateForm.vue'
import RuleCreateForm from '@/components/settings/pyrola-files/RuleCreateForm.vue'
import SkillCreateForm from '@/components/settings/pyrola-files/SkillCreateForm.vue'
import StudioCreateForm from '@/components/settings/pyrola-files/StudioCreateForm.vue'
import type { PyrolaFilesKind } from '@/services/pyrola/pyrola-tauri'

defineProps<{
  kind: PyrolaFilesKind
  open: boolean
  scope: 'personal' | 'project'
  projectRoot?: string
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'submitted'): void
}>()
</script>

<template>
  <PlanCreateForm
    v-if="kind === 'plans'"
    :open="open"
    :scope="scope"
    :project-root="projectRoot"
    @update:open="emit('update:open', $event)"
    @submitted="emit('submitted')"
  />
  <SkillCreateForm
    v-else-if="kind === 'skills'"
    :open="open"
    :scope="scope"
    :project-root="projectRoot"
    @update:open="emit('update:open', $event)"
    @submitted="emit('submitted')"
  />
  <AgentCreateForm
    v-else-if="kind === 'agents'"
    :open="open"
    :scope="scope"
    :project-root="projectRoot"
    @update:open="emit('update:open', $event)"
    @submitted="emit('submitted')"
  />
  <RuleCreateForm
    v-else-if="kind === 'rules'"
    :open="open"
    :scope="scope"
    :project-root="projectRoot"
    @update:open="emit('update:open', $event)"
    @submitted="emit('submitted')"
  />
  <StudioCreateForm
    v-else-if="kind === 'studio'"
    :open="open"
    :scope="scope"
    :project-root="projectRoot"
    @update:open="emit('update:open', $event)"
    @submitted="emit('submitted')"
  />
</template>
