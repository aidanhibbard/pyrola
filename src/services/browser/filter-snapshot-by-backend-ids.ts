import type { SnapshotNode } from '@/types/browser/snapshot-node'

const filterSnapshotByBackendIds = (
  nodes: SnapshotNode[],
  backendIds: Set<number>,
): SnapshotNode[] => {
  const walk = (node: SnapshotNode): SnapshotNode | null => {
    const children: SnapshotNode[] = []
    for (const child of node.children) {
      const next = walk(child)
      if (next) {
        children.push(next)
      }
    }
    const matched =
      typeof node.backendDOMNodeId === 'number'
      && backendIds.has(node.backendDOMNodeId)
    if (!matched && children.length === 0) {
      return null
    }
    return { ...node, children }
  }

  const filtered: SnapshotNode[] = []
  for (const node of nodes) {
    const next = walk(node)
    if (next) {
      filtered.push(next)
    }
  }
  return filtered
}

export default filterSnapshotByBackendIds
