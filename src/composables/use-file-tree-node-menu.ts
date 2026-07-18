import { inject, type InjectionKey, type Ref } from 'vue'
import { toast } from 'vue-sonner'
import { useFileTreeContext } from '@/components/ai-elements/file-tree/context'
import { revealInFolder } from '@/services/pyrola/pyrola-tauri'

export const FileTreeProjectRootKey: InjectionKey<Ref<string | null>> =
  Symbol('FileTreeProjectRoot')

const toAbsolutePath = (projectRoot: string, relativePath: string): string => {
  if (relativePath === '.' || relativePath === '') {
    return projectRoot
  }
  return `${projectRoot.replace(/\/$/, '')}/${relativePath}`
}

const parentDirectoryPath = (absolutePath: string): string => {
  const lastSlash = absolutePath.lastIndexOf('/')
  if (lastSlash <= 0) {
    return absolutePath
  }
  return absolutePath.slice(0, lastSlash)
}

export default () => {
  const projectRoot = inject(FileTreeProjectRootKey)
  if (!projectRoot) {
    throw new Error('useFileTreeNodeMenu must be used within a file tree project root provider')
  }

  const { onSelect } = useFileTreeContext()

  const copyText = async (text: string, failureTitle: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (error) {
      toast.error(failureTitle, {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const copyRelativePath = async (relativePath: string): Promise<void> => {
    const displayPath = relativePath === '' ? '.' : relativePath
    await copyText(displayPath, 'Failed to copy relative path')
  }

  const copyAbsolutePath = async (relativePath: string): Promise<void> => {
    const root = projectRoot.value
    if (!root) {
      toast.error('Failed to copy path', {
        description: 'Project root is unavailable',
      })
      return
    }
    await copyText(toAbsolutePath(root, relativePath), 'Failed to copy path')
  }

  const copyName = async (name: string): Promise<void> => {
    await copyText(name, 'Failed to copy name')
  }

  const revealInFinder = async (
    relativePath: string,
    isDirectory: boolean,
  ): Promise<void> => {
    const root = projectRoot.value
    if (!root) {
      toast.error('Failed to reveal in Finder', {
        description: 'Project root is unavailable',
      })
      return
    }

    const absolutePath = toAbsolutePath(root, relativePath)
    const revealPath = isDirectory ? absolutePath : parentDirectoryPath(absolutePath)

    try {
      await revealInFolder(revealPath)
    } catch (error) {
      toast.error('Failed to reveal in Finder', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const openInEditor = (relativePath: string): void => {
    onSelect(relativePath)
  }

  return {
    copyRelativePath,
    copyAbsolutePath,
    copyName,
    revealInFinder,
    openInEditor,
  }
}
