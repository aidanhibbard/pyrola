export type TreeNode = {
  name: string
  path: string
  kind: string
  children?: TreeNode[]
}

export const findNode = (
  nodes: TreeNode[] | undefined,
  path: string,
): TreeNode | null => {
  if (!nodes) {
    return null
  }
  for (const node of nodes) {
    if (node.path === path) {
      return node
    }
    const nested = findNode(node.children, path)
    if (nested) {
      return nested
    }
  }
  return null
}

export const findNodeKind = (
  nodes: TreeNode[] | undefined,
  path: string,
): string | null => findNode(nodes, path)?.kind ?? null

export const ancestorDirectoryPaths = (path: string): string[] => {
  if (!path || path === '.') {
    return []
  }
  const parts = path.split('/')
  const dirs: string[] = []
  for (let i = 0; i < parts.length - 1; i += 1) {
    dirs.push(parts.slice(0, i + 1).join('/'))
  }
  return dirs
}

export const treeErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'Unknown error'
}

export const parentPath = (path: string): string => {
  if (!path.includes('/')) {
    return '.'
  }
  return path.split('/').slice(0, -1).join('/') || '.'
}

export const joinPath = (directory: string, name: string): string => {
  if (directory === '.' || directory === '') {
    return name
  }
  return `${directory}/${name}`
}
