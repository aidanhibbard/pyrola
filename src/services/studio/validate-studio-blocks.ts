import { parse } from 'comark'
import type { ComarkNode } from 'comark'
import type { z } from 'zod'
import calloutBlockSchema from '@/schemas/studio/blocks/callout'
import chartBlockSchema from '@/schemas/studio/blocks/chart'
import dividerBlockSchema from '@/schemas/studio/blocks/divider'
import gridBlockSchema from '@/schemas/studio/blocks/grid'
import metricsBlockSchema from '@/schemas/studio/blocks/metrics'
import mermaidBlockSchema from '@/schemas/studio/blocks/mermaid'
import pageHeaderBlockSchema from '@/schemas/studio/blocks/page-header'
import pillBlockSchema from '@/schemas/studio/blocks/pill'
import rowBlockSchema from '@/schemas/studio/blocks/row'
import tableBlockSchema from '@/schemas/studio/blocks/table'
import usageBarBlockSchema from '@/schemas/studio/blocks/usage-bar'
import { formatStudioSchemaError } from '@/schemas/studio-document'

const STUDIO_BLOCK_SCHEMAS: Record<string, z.ZodType<Record<string, unknown>>> = {
  'page-header': pageHeaderBlockSchema,
  metrics: metricsBlockSchema,
  stat: metricsBlockSchema,
  chart: chartBlockSchema,
  table: tableBlockSchema,
  callout: calloutBlockSchema,
  grid: gridBlockSchema,
  row: rowBlockSchema,
  mermaid: mermaidBlockSchema,
  'usage-bar': usageBarBlockSchema,
  pill: pillBlockSchema,
  divider: dividerBlockSchema,
}

const isComarkElement = (node: ComarkNode): node is [string, Record<string, unknown>, ...ComarkNode[]] =>
  Array.isArray(node) && typeof node[0] === 'string'

const normalizeBlockProps = (attrs: Record<string, unknown>): Record<string, unknown> => {
  const props: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(attrs)) {
    if (key === '$' || key.startsWith('#') || key.startsWith(':')) {
      continue
    }
    props[key] = value
  }
  return props
}

const collectBlockErrors = (nodes: ComarkNode[], errors: string[]): void => {
  for (const node of nodes) {
    if (!isComarkElement(node)) {
      continue
    }

    const [tag, attrs, ...children] = node
    const schema = STUDIO_BLOCK_SCHEMAS[tag]
    if (schema) {
      const result = schema.safeParse(normalizeBlockProps(attrs))
      if (!result.success) {
        errors.push(`Invalid ${tag} block: ${formatStudioSchemaError(result.error)}`)
      }
    }

    const nestedElements = children.filter(isComarkElement)
    if (nestedElements.length > 0) {
      collectBlockErrors(nestedElements, errors)
    }
  }
}

export default async (body: string): Promise<string | null> => {
  try {
    const tree = await parse(body, { html: false })
    const errors: string[] = []
    collectBlockErrors(tree.nodes, errors)
    return errors.length > 0 ? errors.join('; ') : null
  } catch {
    return null
  }
}
