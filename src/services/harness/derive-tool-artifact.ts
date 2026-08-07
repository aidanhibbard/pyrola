import type { ChatArtifact } from '@/types/chat/chat-artifact'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object'

const fileArtifact = (path: string | undefined): ChatArtifact | undefined => {
  if (!path) {
    return undefined
  }
  return { kind: 'file', path }
}

const pathFromResultOrArgs = (
  result: Record<string, unknown>,
  args: unknown,
  resultKey = 'path',
  argsKey = 'path',
): string | undefined => {
  if (typeof result[resultKey] === 'string') {
    return result[resultKey] as string
  }
  if (isRecord(args) && typeof args[argsKey] === 'string') {
    return args[argsKey] as string
  }
  return undefined
}

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

  if (
    name === 'write_file' ||
    name === 'edit_file' ||
    name === 'read_file' ||
    name === 'delete_file'
  ) {
    return fileArtifact(pathFromResultOrArgs(result, args))
  }

  if (name === 'move_file') {
    return fileArtifact(pathFromResultOrArgs(result, args, 'to', 'to'))
  }

  if (name === 'apply_patch') {
    if (Array.isArray(result.paths)) {
      const first = result.paths.find(
        (entry): entry is string => typeof entry === 'string' && entry.length > 0,
      )
      if (first) {
        return fileArtifact(first)
      }
    }
    if (Array.isArray(result.diffs)) {
      for (const entry of result.diffs) {
        if (isRecord(entry) && typeof entry.path === 'string') {
          return fileArtifact(entry.path)
        }
      }
    }
    return undefined
  }

  return undefined
}
