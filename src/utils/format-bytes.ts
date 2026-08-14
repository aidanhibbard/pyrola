const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

export default (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '0 B'
  }

  if (bytes < 1024) {
    return `${Math.round(bytes)} B`
  }

  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < UNITS.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const digits = value >= 10 ? 0 : 1
  return `${value.toFixed(digits)} ${UNITS[unitIndex]}`
}
