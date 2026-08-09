import type { McpIcon } from '@/types/mcp/mcp-icon'

const isAllowedIconSrc = (src: string): boolean => {
  if (src.startsWith('data:image/')) return true
  try {
    const url = new URL(src)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

const scoreIcon = (icon: McpIcon, theme: 'light' | 'dark' | null): number => {
  let score = 0
  if (theme && icon.theme === theme) score += 4
  if (!icon.theme) score += 1
  if (icon.sizes?.includes('any')) score += 2
  if (icon.mimeType === 'image/svg+xml') score += 1
  return score
}

const resolveMcpServerIconSrc = (
  icons: McpIcon[] | null | undefined,
  theme: 'light' | 'dark' | null = null,
): string | null => {
  if (!icons || icons.length === 0) return null

  const allowed = icons.filter((icon) => isAllowedIconSrc(icon.src))
  if (allowed.length === 0) return null

  const ranked = [...allowed].sort(
    (a, b) => scoreIcon(b, theme) - scoreIcon(a, theme),
  )
  return ranked[0]?.src ?? null
}

export default resolveMcpServerIconSrc
