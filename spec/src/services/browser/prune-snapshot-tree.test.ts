import { describe, expect, it } from 'vitest'
import pruneSnapshotTree from '@/services/browser/prune-snapshot-tree'
import filterSnapshotByBackendIds from '@/services/browser/filter-snapshot-by-backend-ids'
import type { SnapshotNode } from '@/types/browser/snapshot-node'

const tree: SnapshotNode[] = [
  {
    ref: 'root',
    role: 'RootWebArea',
    name: 'Page',
    children: [
      {
        ref: 'g',
        role: 'generic',
        name: null,
        children: [],
      },
      {
        ref: 'btn',
        role: 'button',
        name: 'Go',
        backendDOMNodeId: 42,
        children: [],
      },
    ],
  },
]

describe('pruneSnapshotTree', () => {
  it('keeps interactive roles and ancestors', () => {
    const pruned = pruneSnapshotTree(tree, { interactive: true })
    expect(pruned[0]?.children.map((child) => child.ref)).toEqual(['btn'])
  })

  it('drops nameless generic leaves when compact', () => {
    const pruned = pruneSnapshotTree(tree, { compact: true })
    expect(pruned[0]?.children.map((child) => child.ref)).toEqual(['btn'])
  })

  it('truncates by maxDepth', () => {
    const pruned = pruneSnapshotTree(tree, { maxDepth: 0 })
    expect(pruned[0]?.children).toEqual([])
  })

  it('filters by backend node ids', () => {
    const filtered = filterSnapshotByBackendIds(tree, new Set([42]))
    expect(filtered[0]?.children.map((child) => child.ref)).toEqual(['btn'])
  })
})
