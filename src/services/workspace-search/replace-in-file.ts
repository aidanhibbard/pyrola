import type { SearchReplaceOptions } from '@/types/workbench/search-replace-options'
import applyReplace from './apply-replace'
import readReplaceTarget from './read-replace-target'
import writeReplaceTarget from './write-replace-target'

export default async (args: {
  projectRoot: string
  path: string
  find: string
  replace: string
  options: SearchReplaceOptions
}): Promise<{ count: number }> => {
  const content = await readReplaceTarget({
    projectRoot: args.projectRoot,
    path: args.path,
  })
  const result = applyReplace(
    content,
    args.find,
    args.replace,
    args.options,
  )
  if (result.count === 0 || result.content === content) {
    return { count: 0 }
  }
  await writeReplaceTarget({
    projectRoot: args.projectRoot,
    path: args.path,
    content: result.content,
  })
  return { count: result.count }
}
