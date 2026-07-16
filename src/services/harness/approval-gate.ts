import type { FileDiff } from '@/types/harness/file-diff'

export type PendingApproval = {
  toolCallId: string
  name: string
  diff: FileDiff[]
  resolve: (approved: boolean) => void
}

const pending = new Map<string, PendingApproval>()

export const requestApproval = (
  toolCallId: string,
  name: string,
  diff: FileDiff[],
): Promise<boolean> =>
  new Promise((resolve) => {
    pending.set(toolCallId, { toolCallId, name, diff, resolve })
  })

export const getPendingApproval = (toolCallId: string): PendingApproval | undefined =>
  pending.get(toolCallId)

export const resolveApproval = (toolCallId: string, approved: boolean): void => {
  const entry = pending.get(toolCallId)
  if (!entry) {
    return
  }
  pending.delete(toolCallId)
  entry.resolve(approved)
}

export const rejectAllPending = (): void => {
  for (const entry of pending.values()) {
    entry.resolve(false)
  }
  pending.clear()
}

export const matchesAutoApproveGlob = (path: string, globs: string[]): boolean =>
  globs.some((glob) => {
    const pattern = glob
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '<<GLOBSTAR>>')
      .replace(/\*/g, '[^/]*')
      .replace(/<<GLOBSTAR>>/g, '.*')
    return new RegExp(`^${pattern}$`).test(path)
  })

export const shouldAutoApprove = (
  paths: string[],
  autoApproveGlobs: string[],
): boolean => paths.every((path) => matchesAutoApproveGlob(path, autoApproveGlobs))
