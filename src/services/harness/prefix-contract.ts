import type { PrefixSnapshot } from '@/types/harness/prefix-snapshot'

type PrefixParts = {
  systemString: string
  toolSchemasJson: string
  mcpCatalogSnapshot: string
  rulesBodies: string
}

const djb2 = (str: string): string => {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
    hash = hash >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

export const hashPrefixParts = (parts: PrefixParts): string => {
  const combined = [
    parts.systemString,
    parts.toolSchemasJson,
    parts.mcpCatalogSnapshot,
    parts.rulesBodies,
  ].join('\x00')
  return djb2(combined)
}

export const buildPrefixSnapshot = (parts: PrefixParts): PrefixSnapshot => ({
  systemString: parts.systemString,
  toolSchemasJson: parts.toolSchemasJson,
  mcpCatalogSnapshot: parts.mcpCatalogSnapshot,
  rulesBodies: parts.rulesBodies,
  hash: hashPrefixParts(parts),
  frozenAt: new Date().toISOString(),
})

export const getFrozenPrefix = (meta: { prefixSnapshot?: unknown }): PrefixSnapshot | null => {
  const snap = meta.prefixSnapshot
  if (
    typeof snap !== 'object' ||
    snap === null ||
    typeof (snap as Record<string, unknown>).systemString !== 'string' ||
    typeof (snap as Record<string, unknown>).hash !== 'string' ||
    typeof (snap as Record<string, unknown>).frozenAt !== 'string'
  ) {
    return null
  }
  return snap as PrefixSnapshot
}
