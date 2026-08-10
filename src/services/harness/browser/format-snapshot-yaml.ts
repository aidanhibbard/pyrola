import type { SnapshotNode } from '@/types/browser/snapshot-node'

const escapeName = (name: string): string => name.replaceAll('"', '\\"')

const formatNode = (node: SnapshotNode, indent: number): string[] => {
  const pad = '  '.repeat(indent)
  const role = node.role ?? 'generic'
  const namePart = node.name ? ` "${escapeName(node.name)}"` : ''
  const lines = [`${pad}- ${role}${namePart} [ref=${node.ref}]`]
  for (const child of node.children) {
    lines.push(...formatNode(child, indent + 1))
  }
  return lines
}

const formatSnapshotYaml = (nodes: SnapshotNode[]): string => {
  if (nodes.length === 0) {
    return '(empty snapshot)'
  }
  return nodes.flatMap((node) => formatNode(node, 0)).join('\n')
}

export default formatSnapshotYaml
