import type { ApprovalKind, PermissionRecord } from '@/types/harness/permission'

export type PermissionSubgroup = {
  key: string
  label: string | null
  records: PermissionRecord[]
}

export type PermissionGroup = {
  kind: ApprovalKind
  label: string
  subgroups: PermissionSubgroup[]
}
