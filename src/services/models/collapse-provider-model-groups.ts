import type { ProviderModelGroup } from '@/types/models/provider-model-group'
import { collapseModelVariants } from '@/services/models/parse-model-variant'

export const collapseProviderModelGroups = (
  groups: ProviderModelGroup[],
): ProviderModelGroup[] =>
  groups.map((group) => ({
    ...group,
    models: collapseModelVariants(group.models),
  }))

export default collapseProviderModelGroups
