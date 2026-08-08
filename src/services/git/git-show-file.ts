import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '@/services/pyrola/pyrola-tauri'
import type { GitShowFileResult } from '@/types/git/git-show-file-result'

export default async (
  projectRoot: string,
  path: string,
): Promise<GitShowFileResult> => {
  if (!isTauri()) {
    return { content: '', exists: false }
  }
  return invoke<GitShowFileResult>('git_show_file', { projectRoot, path })
}
