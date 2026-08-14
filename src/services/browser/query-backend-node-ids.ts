import type CdpClient from '@/services/browser/cdp-client'

type DescribeNodeResult = {
  node?: {
    backendNodeId?: number
  }
}

const queryBackendNodeIds = async (
  client: CdpClient,
  sessionId: string,
  selector: string,
): Promise<Set<number>> => {
  await client.send('DOM.enable', {}, sessionId)
  const doc = (await client.send(
    'DOM.getDocument',
    { depth: 0 },
    sessionId,
  )) as { root?: { nodeId?: number } }
  const rootId = doc.root?.nodeId
  if (typeof rootId !== 'number') {
    return new Set()
  }

  const result = (await client.send(
    'DOM.querySelectorAll',
    { nodeId: rootId, selector },
    sessionId,
  )) as { nodeIds?: number[] }

  const ids = new Set<number>()
  for (const nodeId of result.nodeIds ?? []) {
    const described = (await client.send(
      'DOM.describeNode',
      { nodeId },
      sessionId,
    )) as DescribeNodeResult
    const backendId = described.node?.backendNodeId
    if (typeof backendId === 'number') {
      ids.add(backendId)
    }
  }
  return ids
}

export default queryBackendNodeIds
