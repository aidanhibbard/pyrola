export const fileExtension = (path: string): string => {
  const normalized = path.replace(/\\/g, '/')
  const base = normalized.slice(normalized.lastIndexOf('/') + 1)
  const lower = base.toLowerCase()
  if (lower === 'dockerfile') {
    return 'dockerfile'
  }
  if (lower === 'makefile' || lower === 'gnumakefile') {
    return 'make'
  }
  const dot = base.lastIndexOf('.')
  if (dot <= 0 || dot === base.length - 1) {
    return ''
  }
  return base.slice(dot + 1)
}

export const workspacePathToFileUri = (projectRoot: string, path: string): string => {
  const root = projectRoot.replace(/\\/g, '/').replace(/\/$/, '')
  const relative = path.replace(/^\//, '')
  let absolute = `${root}/${relative}`
  if (!absolute.startsWith('/')) {
    absolute = `/${absolute}`
  }
  return `file://${absolute}`
}

export const normalizeFileUri = (uri: string): string => {
  try {
    return decodeURIComponent(new URL(uri).pathname)
  } catch {
    return decodeURIComponent(uri.replace(/^file:\/\//, ''))
  }
}
