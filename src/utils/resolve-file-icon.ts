import {
  getIconForDirectoryPath,
  getIconForFilePath,
  getIconUrlByName,
  getIconUrlForFilePath,
  isMaterialIconName,
  type MaterialIcon,
} from 'vscode-material-icons'

export const FILE_ICON_BASE = '/file-icons'

export type ResolvedFileIcon = {
  src: string
  icon: MaterialIcon
}

const resolveOpenFolderIcon = (closedIcon: MaterialIcon): MaterialIcon => {
  if (closedIcon.endsWith('-open')) {
    return closedIcon
  }
  const openIcon = `${closedIcon}-open` as MaterialIcon
  if (isMaterialIconName(openIcon)) {
    return openIcon
  }
  return 'folder-open'
}

export default (
  name: string,
  options?: { isDirectory?: boolean; isOpen?: boolean },
): ResolvedFileIcon => {
  if (options?.isDirectory) {
    const closedIcon = getIconForDirectoryPath(name)
    const icon = options.isOpen ? resolveOpenFolderIcon(closedIcon) : closedIcon
    return {
      icon,
      src: getIconUrlByName(icon, FILE_ICON_BASE),
    }
  }

  const icon = getIconForFilePath(name)
  return {
    icon,
    src: getIconUrlForFilePath(name, FILE_ICON_BASE),
  }
}
