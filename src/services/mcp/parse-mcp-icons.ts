import type { McpIcon } from '@/types/mcp/mcp-icon'

const parseMcpIcons = (value: unknown): McpIcon[] | null => {
  if (!Array.isArray(value)) return null
  const icons: McpIcon[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    if (typeof record.src !== 'string' || record.src.length === 0) continue
    const icon: McpIcon = { src: record.src }
    if (typeof record.mimeType === 'string') icon.mimeType = record.mimeType
    if (Array.isArray(record.sizes)) {
      icon.sizes = record.sizes.filter((size): size is string => typeof size === 'string')
    }
    if (record.theme === 'light' || record.theme === 'dark') icon.theme = record.theme
    icons.push(icon)
  }
  return icons.length > 0 ? icons : null
}

export default parseMcpIcons
