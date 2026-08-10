const isSandboxSpawnError = (message: string): boolean =>
  message.startsWith('SANDBOX_FAILED:') ||
  message.startsWith('SANDBOX_UNAVAILABLE:') ||
  message.startsWith('SANDBOX_RUNTIME_BLOCKED:')

const SANDBOX_DENIAL_DETAIL_MAX = 500

const trimSandboxDenialDetail = (detail: string): string => {
  const trimmed = detail.trim()
  if (trimmed.length <= SANDBOX_DENIAL_DETAIL_MAX) {
    return trimmed
  }
  return `${trimmed.slice(0, SANDBOX_DENIAL_DETAIL_MAX)}...`
}

/** Detect Seatbelt / sandbox runtime denials from command output (not spawn failures). */
const detectSandboxRuntimeDenial = (
  combinedOutput: string,
): 'filesystem' | 'network' | null => {
  const text = combinedOutput

  const hasNodeLstatEperm =
    text.includes('EPERM') &&
    text.includes('operation not permitted') &&
    text.includes('lstat')
  const hasGenericOperationNotPermitted = text.includes('Operation not permitted')
  if (hasNodeLstatEperm || hasGenericOperationNotPermitted) {
    return 'filesystem'
  }

  const hasNetworkConnect = /error connecting to\s+\S+/i.test(text)
  const hasCouldNotResolve = text.includes('Could not resolve host')
  const hasNetworkUnreachable = text.includes('Network is unreachable')
  if (hasNetworkConnect || hasCouldNotResolve || hasNetworkUnreachable) {
    return 'network'
  }

  return null
}

const sandboxRuntimeDenialError = (
  kind: 'filesystem' | 'network',
  detail: string,
): Error => {
  const trimmed = trimSandboxDenialDetail(detail)
  if (kind === 'filesystem') {
    return new Error(
      `SANDBOX_RUNTIME_BLOCKED: Sandbox blocked this command (filesystem EPERM). The macOS Seatbelt profile denied a file read during command execution. Approve an unsandboxed retry, or use an MCP tool for network data. Detail: ${trimmed}`,
    )
  }
  return new Error(
    `SANDBOX_RUNTIME_BLOCKED: Sandbox blocked this command (network denied). Sandboxed shell has no network by default. Use an MCP tool (e.g. brave) for network data, or approve an unsandboxed retry. Detail: ${trimmed}`,
  )
}

export {
  detectSandboxRuntimeDenial,
  isSandboxSpawnError,
  sandboxRuntimeDenialError,
}
