import type { SnapshotNode } from '@/types/browser/snapshot-node'

const INTERACTIVE_ROLES = new Set([
  'button',
  'link',
  'textbox',
  'searchbox',
  'combobox',
  'listbox',
  'option',
  'checkbox',
  'radio',
  'switch',
  'slider',
  'spinbutton',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'tab',
  'treeitem',
])

const COMPACT_SKIP_ROLES = new Set(['generic', 'none', 'InlineTextBox', 'LineBreak'])

type PruneOptions = {
  interactive?: boolean
  maxDepth?: number
  compact?: boolean
}

const pruneNode = (
  node: SnapshotNode,
  depth: number,
  options: PruneOptions,
): SnapshotNode | null => {
  if (typeof options.maxDepth === 'number' && depth > options.maxDepth) {
    return null
  }

  const children: SnapshotNode[] = []
  for (const child of node.children) {
    const pruned = pruneNode(child, depth + 1, options)
    if (pruned) {
      children.push(pruned)
    }
  }

  const next: SnapshotNode = { ...node, children }
  const role = next.role ?? ''
  const selfInteractive = INTERACTIVE_ROLES.has(role)

  if (options.interactive && !selfInteractive && children.length === 0) {
    return null
  }

  if (
    options.compact
    && !next.name
    && COMPACT_SKIP_ROLES.has(role)
    && children.length === 0
  ) {
    return null
  }

  return next
}

const pruneSnapshotTree = (
  nodes: SnapshotNode[],
  options: PruneOptions,
): SnapshotNode[] => {
  const pruned: SnapshotNode[] = []
  for (const node of nodes) {
    const next = pruneNode(node, 0, options)
    if (next) {
      pruned.push(next)
    }
  }
  return pruned
}

export default pruneSnapshotTree
