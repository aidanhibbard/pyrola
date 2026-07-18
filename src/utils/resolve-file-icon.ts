import { getIconUrlForFilePath } from 'vscode-material-icons'

export const FILE_ICON_BASE = '/file-icons'

export type ResolvedFileIcon = { src: string } | null

export default (
  name: string,
  options?: { isDirectory?: boolean; isOpen?: boolean },
): ResolvedFileIcon => {
  if (options?.isDirectory) {
    return null
  }

  return {
    src: getIconUrlForFilePath(name, FILE_ICON_BASE),
  }
}
