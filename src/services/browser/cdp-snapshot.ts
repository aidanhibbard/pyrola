import type CdpClient from '@/services/browser/cdp-client'
import pruneSnapshotTree from '@/services/browser/prune-snapshot-tree'
import filterSnapshotByBackendIds from '@/services/browser/filter-snapshot-by-backend-ids'
import queryBackendNodeIds from '@/services/browser/query-backend-node-ids'
import type { SnapshotCaptureOptions } from '@/types/browser/snapshot-capture-options'
import type { AccessibilitySnapshot, SnapshotNode } from '@/types/browser/snapshot-node'

type AxPropertyValue = {
  type?: string
  value?: unknown
}

type AxNode = {
  nodeId?: string
  ignored?: boolean
  role?: AxPropertyValue
  name?: AxPropertyValue
  childIds?: string[]
  parentId?: string
  backendDOMNodeId?: number
}

type ResolveNodeResult = {
  object?: {
    objectId?: string
  }
}

type SnapshotState = {
  snapshotId: string
  nodesByRef: Map<string, SnapshotNode>
}

const lastSnapshots = new Map<string, SnapshotState>()

const axString = (value: AxPropertyValue | undefined): string | null => {
  if (!value) {
    return null
  }
  if (typeof value.value === 'string') {
    return value.value
  }
  if (typeof value.value === 'number' || typeof value.value === 'boolean') {
    return String(value.value)
  }
  return null
}

export const getAccessibilitySnapshot = async (
  client: CdpClient,
  sessionId: string,
  options: SnapshotCaptureOptions = {},
): Promise<AccessibilitySnapshot> => {
  await client.send('Accessibility.enable', {}, sessionId)
  const result = (await client.send(
    'Accessibility.getFullAXTree',
    {},
    sessionId,
  )) as { nodes?: AxNode[] }

  const rawNodes = Array.isArray(result.nodes) ? result.nodes : []
  const byId = new Map<string, SnapshotNode>()

  for (const raw of rawNodes) {
    if (typeof raw.nodeId !== 'string') {
      continue
    }
    const node: SnapshotNode = {
      ref: raw.nodeId,
      role: axString(raw.role),
      name: axString(raw.name),
      children: [],
    }
    if (typeof raw.backendDOMNodeId === 'number') {
      node.backendDOMNodeId = raw.backendDOMNodeId
    }
    byId.set(raw.nodeId, node)
  }

  const roots: SnapshotNode[] = []
  for (const raw of rawNodes) {
    if (typeof raw.nodeId !== 'string') {
      continue
    }
    const node = byId.get(raw.nodeId)
    if (!node) {
      continue
    }
    const childIds = Array.isArray(raw.childIds) ? raw.childIds : []
    for (const childId of childIds) {
      const child = byId.get(childId)
      if (child) {
        node.children.push(child)
      }
    }
    const hasParent =
      typeof raw.parentId === 'string' && byId.has(raw.parentId)
    if (!hasParent) {
      roots.push(node)
    }
  }

  let nodes = roots
  if (options.selector?.trim()) {
    const backendIds = await queryBackendNodeIds(
      client,
      sessionId,
      options.selector.trim(),
    )
    nodes = filterSnapshotByBackendIds(nodes, backendIds)
  }
  nodes = pruneSnapshotTree(nodes, {
    interactive: options.interactive,
    maxDepth: options.maxDepth,
    compact: options.compact,
  })

  const nodesByRef = new Map<string, SnapshotNode>()
  const collect = (node: SnapshotNode): void => {
    nodesByRef.set(node.ref, node)
    for (const child of node.children) {
      collect(child)
    }
  }
  for (const node of nodes) {
    collect(node)
  }

  const snapshotId = crypto.randomUUID()
  lastSnapshots.set(sessionId, {
    snapshotId,
    nodesByRef,
  })

  return { snapshotId, nodes }
}

export const getSnapshotNode = (
  sessionId: string,
  ref: string,
): SnapshotNode | null => {
  const snapshot = lastSnapshots.get(sessionId)
  return snapshot?.nodesByRef.get(ref) ?? null
}

export const resolveRef = async (
  client: CdpClient,
  sessionId: string,
  ref: string,
): Promise<{ backendNodeId: number; objectId: string } | null> => {
  const snapshot = lastSnapshots.get(sessionId)
  const node = snapshot?.nodesByRef.get(ref)
  if (!node || typeof node.backendDOMNodeId !== 'number') {
    return null
  }

  await client.send('DOM.enable', {}, sessionId)
  const resolved = (await client.send(
    'DOM.resolveNode',
    { backendNodeId: node.backendDOMNodeId },
    sessionId,
  )) as ResolveNodeResult

  const objectId = resolved.object?.objectId
  if (typeof objectId !== 'string' || objectId.length === 0) {
    return null
  }

  return {
    backendNodeId: node.backendDOMNodeId,
    objectId,
  }
}

export const resetSnapshotsForTests = (): void => {
  lastSnapshots.clear()
}
