<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import ModelsSearchModelSearchPicker from '@/components/models/search/ModelSearchPicker.vue'
import { Button } from '@/components/shadcn/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/ui/dialog'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import listConfiguredProviders from '@/services/providers/list-configured-providers'
import resolveModelForRole from '@/services/models/resolve-model-for-role'

const props = defineProps<{
  open: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: [payload: { parentModel: string; subagentModel: string }]
}>()

const config = usePyrolaConfig()
const parentModel = ref('')
const subagentModel = ref('')

const hasProviders = computed(
  () => listConfiguredProviders(config.effectiveSettings.value).length > 0,
)

const canConfirm = computed(
  () =>
    hasProviders.value &&
    parentModel.value.trim().length > 0 &&
    subagentModel.value.trim().length > 0 &&
    !props.disabled,
)

const syncDefaults = (): void => {
  parentModel.value =
    resolveModelForRole('orchestrator', config.effectiveSettings.value) ?? ''
  subagentModel.value =
    resolveModelForRole('agent', config.effectiveSettings.value) ?? ''
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      syncDefaults()
    }
  },
)

const handleOpenChange = (open: boolean): void => {
  emit('update:open', open)
}

const handleParentChange = (value: string): void => {
  if (value.length > 0) {
    parentModel.value = value
  }
}

const handleSubagentChange = (value: string): void => {
  if (value.length > 0) {
    subagentModel.value = value
  }
}

const handleConfirm = (): void => {
  if (!parentModel.value.trim()) {
    toast.error('Select a parent model')
    return
  }
  if (!subagentModel.value.trim()) {
    toast.error('Select a sub-agent model')
    return
  }
  emit('confirm', {
    parentModel: parentModel.value.trim(),
    subagentModel: subagentModel.value.trim(),
  })
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="handleOpenChange">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Orchestrate plan</DialogTitle>
        <DialogDescription>
          Choose the parent orchestrator model and the only sub-agent model it may spawn.
        </DialogDescription>
      </DialogHeader>
      <div class="space-y-4 py-2">
        <div class="space-y-2">
          <p class="text-sm font-medium">Parent</p>
          <ModelsSearchModelSearchPicker
            :model-value="parentModel"
            :disabled="!hasProviders || disabled"
            placeholder="Select parent model"
            @update:model-value="handleParentChange"
          />
        </div>
        <div class="space-y-2">
          <p class="text-sm font-medium">Sub-agent</p>
          <ModelsSearchModelSearchPicker
            :model-value="subagentModel"
            :disabled="!hasProviders || disabled"
            placeholder="Select sub-agent model"
            @update:model-value="handleSubagentChange"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="handleOpenChange(false)">
          Cancel
        </Button>
        <Button :disabled="!canConfirm" @click="handleConfirm">
          Orchestrate
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
