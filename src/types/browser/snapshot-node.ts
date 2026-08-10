export type SnapshotNode = {
  ref: string
  role: string | null
  name: string | null
  children: SnapshotNode[]
  backendDOMNodeId?: number
}

export type AccessibilitySnapshot = {
  snapshotId: string
  nodes: SnapshotNode[]
}
