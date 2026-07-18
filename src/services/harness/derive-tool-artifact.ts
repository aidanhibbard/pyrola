import type { ChatArtifact } from '@/types/chat/chat-artifact'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object'

export default (
  name: string,
  result: unknown,
  args?: unknown,
  isError = false,
): ChatArtifact | undefined => {
  if (isError) {
    return undefined
  }
  if (!isRecord(result)) {
    return undefined
  }
  if (result.rejected === true) {
    return undefined
  }
  if ('error' in result && result.error) {
    return undefined
  }

  if (name === 'create_plan') {
    const path = typeof result.path === 'string' ? result.path : undefined
    if (!path) {
      return undefined
    }
    const label =
      isRecord(args) && typeof args.title === 'string' ? args.title : undefined
    return { kind: 'plan', path, label }
  }

  if (name === 'write_studio_artifact') {
    const path = typeof result.path === 'string' ? result.path : undefined
    if (!path) {
      return undefined
    }
    return { kind: 'studio', path }
  }

  if (name === 'write_file' || name === 'edit_file') {
    const path =
      typeof result.path === 'string'
        ? result.path
        : isRecord(args) && typeof args.path === 'string'
          ? args.path
          : undefined
    if (!path) {
      return undefined
    }
    return { kind: 'file', path }
  }

  return undefined
}
