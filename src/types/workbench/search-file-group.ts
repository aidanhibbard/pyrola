import type { GrepMatch } from '@/services/pyrola/pyrola-tauri'

export type SearchFileGroup = {
  path: string
  hits: GrepMatch[]
}
