import { fsListDir, fsReadFile } from '@/services/pyrola/pyrola-tauri'
import parseStudioArtifact from '@/services/studio/parse-studio-artifact'

type StudioArtifactListItem = {
  slug: string
  path: string
  title: string | null
}

const STUDIO_ROOT = '.pyrola/studio'

const readArtifactTitle = async (
  projectRoot: string,
  slug: string,
): Promise<string | null> => {
  const path = `${STUDIO_ROOT}/${slug}/index.md`
  try {
    const file = await fsReadFile({ projectRoot, path })
    const parsed = parseStudioArtifact(file.content)
    return parsed.frontmatter?.title ?? null
  } catch {
    return null
  }
}

export default async (projectRoot: string): Promise<StudioArtifactListItem[]> => {
  let entries: Array<{ name: string; path: string; kind: string }>
  try {
    entries = await fsListDir(projectRoot, STUDIO_ROOT)
  } catch {
    return []
  }

  const directories = entries.filter((entry) => entry.kind === 'directory')
  const items = await Promise.all(
    directories.map(async (entry) => {
      const title = await readArtifactTitle(projectRoot, entry.name)
      return {
        slug: entry.name,
        path: `${STUDIO_ROOT}/${entry.name}/index.md`,
        title,
      } satisfies StudioArtifactListItem
    }),
  )

  return items.sort((left, right) => {
    const leftLabel = left.title ?? left.slug
    const rightLabel = right.title ?? right.slug
    return leftLabel.localeCompare(rightLabel, undefined, { sensitivity: 'base' })
  })
}
