import type { GitStatusEntry } from '@/types/git/git-status-entry'

export type GitStatusResult = {
  branch: string | null
  entries: GitStatusEntry[]
}
