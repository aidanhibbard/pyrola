import {
  getIconForDirectoryPath,
  getIconUrlByName,
  getIconUrlForFilePath,
  isMaterialIconName,
} from 'vscode-material-icons'

export const FILE_ICON_BASE = '/file-icons'

export type ResolvedFileIcon = { src: string } | null

export default (
  name: string,
  options?: { isDirectory?: boolean; isOpen?: boolean },
): ResolvedFileIcon => {
  if (options?.isDirectory) {
    const closed = getIconForDirectoryPath(name)
    const openCandidate = `${closed}-open`
    const iconName =
      options.isOpen && isMaterialIconName(openCandidate)
        ? openCandidate
        : closed

    return {
      src: getIconUrlByName(iconName, FILE_ICON_BASE),
    }
  }

  return {
    src: getIconUrlForFilePath(name, FILE_ICON_BASE),
  }
}
