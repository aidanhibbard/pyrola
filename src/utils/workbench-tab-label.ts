import type { WorkbenchTabType } from '@/types/workbench/workbench-tab'

export default (type: WorkbenchTabType): string => {
  switch (type) {
    case 'editor':
      return 'Editor'
    case 'terminal':
      return 'Terminal'
    case 'changes':
      return 'Changes'
    case 'browser':
      return 'Browser'
    case 'studio':
      return 'Studio'
    case 'plan':
      return 'Plan'
    default:
      return 'Tab'
  }
}
