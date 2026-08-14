const normalize = (value: string): string => value.replace(/\\/g, '/')

export default (path: string, projectRoot: string): string => {
  const trimmed = path.trim()
  if (!trimmed) {
    return trimmed
  }

  const root = normalize(projectRoot).replace(/\/+$/, '')
  const file = normalize(trimmed)
  if (!root) {
    return file.replace(/^\.\//, '')
  }

  if (file === root) {
    return ''
  }

  const prefix = `${root}/`
  if (file.startsWith(prefix)) {
    return file.slice(prefix.length)
  }

  const fileLower = file.toLowerCase()
  const prefixLower = prefix.toLowerCase()
  if (fileLower.startsWith(prefixLower)) {
    return file.slice(prefix.length)
  }

  return file.replace(/^\.\//, '')
}
