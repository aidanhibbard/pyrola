type NormalizeMcpToolArgsResult =
  | { ok: true; args: Record<string, unknown> }
  | { ok: false; error: string }

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const propertySchemaType = (prop: unknown): string | null => {
  if (!isPlainObject(prop)) {
    return null
  }
  const type = prop.type
  if (typeof type === 'string') {
    return type
  }
  if (Array.isArray(type)) {
    const nonNull = type.filter((item) => item !== 'null')
    if (nonNull.length === 1 && typeof nonNull[0] === 'string') {
      return nonNull[0]
    }
  }
  return null
}

const exampleForStringProp = (key: string): string =>
  JSON.stringify({ [key]: 'search text' })

const describeGot = (value: unknown): string => {
  if (value === null) {
    return 'null'
  }
  if (Array.isArray(value)) {
    return 'array'
  }
  if (typeof value === 'object') {
    return 'object'
  }
  return typeof value
}

/**
 * Coerce common model mistakes against a cached MCP tool inputSchema, and reject
 * clear type mismatches before the opaque MCP -32602 loop.
 */
const normalizeMcpToolArgs = (
  args: Record<string, unknown>,
  inputSchema: Record<string, unknown> | null | undefined,
): NormalizeMcpToolArgsResult => {
  if (!inputSchema || !isPlainObject(inputSchema)) {
    return { ok: true, args }
  }

  const properties = inputSchema.properties
  if (!isPlainObject(properties)) {
    return { ok: true, args }
  }

  const next: Record<string, unknown> = { ...args }

  for (const [key, value] of Object.entries(next)) {
    const propSchema = properties[key]
    if (propSchema === undefined) {
      continue
    }

    const expectedType = propertySchemaType(propSchema)
    if (expectedType !== 'string') {
      continue
    }

    if (typeof value === 'string') {
      continue
    }

    if (isPlainObject(value) && key in value) {
      const inner = value[key]
      if (typeof inner === 'string') {
        next[key] = inner
        continue
      }
    }

    return {
      ok: false,
      error: `Expected args.${key} to be string, got ${describeGot(value)}. Example: ${exampleForStringProp(key)}. Do not nest fields (wrong: args.${key}.${key}; right: args.${key} as a string).`,
    }
  }

  return { ok: true, args: next }
}

export default normalizeMcpToolArgs
