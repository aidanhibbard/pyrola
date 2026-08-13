import type { Ref } from 'vue'
import { findNode, type TreeNode } from './path-helpers'

export default async (
  tree: Ref<TreeNode | null>,
  expandedPaths: Ref<Set<string>>,
  ensureChildrenLoaded: (directoryPath: string) => Promise<void>,
): Promise<void> => {
  const paths = [...expandedPaths.value].sort(
    (left, right) =>
      left.split('/').filter(Boolean).length
      - right.split('/').filter(Boolean).length,
  )
  const nextExpanded = new Set<string>()
  for (const path of paths) {
    if (path === '.' || path === '') {
      nextExpanded.add('.')
      continue
    }
    const currentTree = tree.value
    if (!currentTree) {
      break
    }
    const node = findNode(currentTree.children, path)
    if (!node || node.kind !== 'directory') {
      continue
    }
    await ensureChildrenLoaded(path)
    nextExpanded.add(path)
  }
  if (!nextExpanded.has('.')) {
    nextExpanded.add('.')
  }
  expandedPaths.value = nextExpanded
}
