export type GitStatusEntry = {
  path: string
  oldPath?: string | null
  stagedStatus?: string | null
  unstagedStatus?: string | null
  isUntracked: boolean
  isIgnored: boolean
}
