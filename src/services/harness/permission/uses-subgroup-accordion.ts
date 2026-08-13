import type { ApprovalKind } from '@/types/harness/permission'

const usesPermissionSubgroupAccordion = (kind: ApprovalKind): boolean =>
  kind === 'fs' || kind === 'mcp' || kind === 'web'

export default usesPermissionSubgroupAccordion
