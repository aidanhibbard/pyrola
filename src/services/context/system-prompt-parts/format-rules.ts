import type { ProjectFileEntry } from '@/services/pyrola/pyrola-tauri'
import { fsReadFile } from '@/services/pyrola/pyrola-tauri'

const getRelativePath = (absolutePath: string, projectRoot: string): string | null => {
  const prefix = projectRoot.endsWith('/') ? projectRoot : `${projectRoot}/`
  if (!absolutePath.startsWith(prefix)) {
    return null
  }
  return absolutePath.slice(prefix.length)
}

export default async (
  rules: ProjectFileEntry[],
  projectRoot: string,
): Promise<string> => {
  if (rules.length === 0) {
    return ''
  }

  const blocks: string[] = []
  for (const rule of rules) {
    const relativePath = getRelativePath(rule.path, projectRoot)
    if (!relativePath) {
      blocks.push(`--- ${rule.name} ---\n(outside project root)`)
      continue
    }
    try {
      const result = await fsReadFile({ projectRoot, path: relativePath })
      blocks.push(`--- ${rule.name} ---\n${result.content.trim()}`)
    } catch {
      blocks.push(`--- ${rule.name} ---\n(unreadable)`)
    }
  }

  return blocks.join('\n\n')
}
