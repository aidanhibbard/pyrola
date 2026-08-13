import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { TreeNode } from '@/composables/file-tree-view/path-helpers'

describe('refreshExpandedChildren', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('calls ensureChildrenLoaded for an expanded directory with undefined children', async () => {
    const { default: refreshExpandedChildren } = await import(
      '@/composables/file-tree-view/refresh-expanded-children'
    )

    const tree = ref<TreeNode | null>({
      name: 'root',
      path: '.',
      kind: 'directory',
      children: [
        {
          name: 'src',
          path: 'src',
          kind: 'directory',
          children: undefined,
        },
      ],
    })
    const expandedPaths = ref(new Set(['.', 'src']))
    const ensureChildrenLoaded = vi
      .fn<(directoryPath: string) => Promise<void>>()
      .mockResolvedValue(undefined)

    await refreshExpandedChildren(tree, expandedPaths, ensureChildrenLoaded)

    expect(ensureChildrenLoaded).toHaveBeenCalledWith('src')
    expect(expandedPaths.value.has('src')).toBe(true)
    expect(expandedPaths.value.has('.')).toBe(true)
  })

  it('prunes expandedPaths entries that no longer exist in the tree', async () => {
    const { default: refreshExpandedChildren } = await import(
      '@/composables/file-tree-view/refresh-expanded-children'
    )

    const tree = ref<TreeNode | null>({
      name: 'root',
      path: '.',
      kind: 'directory',
      children: [
        {
          name: 'src',
          path: 'src',
          kind: 'directory',
          children: [],
        },
      ],
    })
    const expandedPaths = ref(new Set(['.', 'src', 'src/missing', 'gone']))
    const ensureChildrenLoaded = vi
      .fn<(directoryPath: string) => Promise<void>>()
      .mockResolvedValue(undefined)

    await refreshExpandedChildren(tree, expandedPaths, ensureChildrenLoaded)

    expect(ensureChildrenLoaded).toHaveBeenCalledWith('src')
    expect(ensureChildrenLoaded).not.toHaveBeenCalledWith('src/missing')
    expect(ensureChildrenLoaded).not.toHaveBeenCalledWith('gone')
    expect([...expandedPaths.value].sort()).toEqual(['.', 'src'])
  })
})
