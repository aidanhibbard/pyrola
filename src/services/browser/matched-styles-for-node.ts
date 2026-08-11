import type CdpClient from '@/services/browser/cdp-client'

const MAX_MATCHED_CSS_LENGTH = 32 * 1024
const TRUNCATION_MARKER = '...[truncated]'

type CssStyleLike = {
  cssText?: string
  cssProperties?: Array<{ name?: string; value?: string }>
}

type CssRuleLike = {
  selectorList?: {
    text?: string
    selectors?: Array<{ text?: string }>
  }
  style?: CssStyleLike
}

type RuleMatchLike = {
  rule?: CssRuleLike
}

type InheritedStyleEntryLike = {
  inlineStyle?: CssStyleLike
  matchedCSSRules?: RuleMatchLike[]
}

type MatchedStylesResult = {
  inlineStyle?: CssStyleLike
  attributesStyle?: CssStyleLike
  matchedCSSRules?: RuleMatchLike[]
  inherited?: InheritedStyleEntryLike[]
}

const styleText = (style: CssStyleLike | undefined): string => {
  if (!style) {
    return ''
  }
  if (typeof style.cssText === 'string' && style.cssText.trim().length > 0) {
    return style.cssText.trim()
  }
  if (!Array.isArray(style.cssProperties)) {
    return ''
  }
  return style.cssProperties
    .filter(
      (prop): prop is { name: string; value: string } =>
        typeof prop?.name === 'string' &&
        prop.name.length > 0 &&
        typeof prop?.value === 'string',
    )
    .map((prop) => `${prop.name}: ${prop.value}`)
    .join('; ')
}

const selectorText = (rule: CssRuleLike | undefined): string => {
  if (!rule?.selectorList) {
    return ''
  }
  if (typeof rule.selectorList.text === 'string' && rule.selectorList.text.length > 0) {
    return rule.selectorList.text
  }
  if (!Array.isArray(rule.selectorList.selectors)) {
    return ''
  }
  return rule.selectorList.selectors
    .map((selector) => (typeof selector?.text === 'string' ? selector.text : ''))
    .filter((text) => text.length > 0)
    .join(', ')
}

const formatRuleMatch = (match: RuleMatchLike): string | null => {
  const selector = selectorText(match.rule)
  const declarations = styleText(match.rule?.style)
  if (!selector && !declarations) {
    return null
  }
  if (!declarations) {
    return `${selector} { }`
  }
  return `${selector} { ${declarations} }`
}

const appendLines = (lines: string[], next: string[]): void => {
  for (const line of next) {
    if (line.length > 0) {
      lines.push(line)
    }
  }
}

const serializeMatchedStyles = (result: MatchedStylesResult): string => {
  const lines: string[] = []

  const matched = Array.isArray(result.matchedCSSRules) ? result.matchedCSSRules : []
  for (const match of matched) {
    const formatted = formatRuleMatch(match)
    if (formatted) {
      lines.push(formatted)
    }
  }

  const inherited = Array.isArray(result.inherited) ? result.inherited : []
  inherited.forEach((entry, index) => {
    const inheritedLines: string[] = []
    const inline = styleText(entry.inlineStyle)
    if (inline) {
      inheritedLines.push(`[inline] { ${inline} }`)
    }
    const inheritedRules = Array.isArray(entry.matchedCSSRules)
      ? entry.matchedCSSRules
      : []
    for (const match of inheritedRules) {
      const formatted = formatRuleMatch(match)
      if (formatted) {
        inheritedLines.push(formatted)
      }
    }
    if (inheritedLines.length === 0) {
      return
    }
    appendLines(lines, [
      `Inherited from ancestor ${index + 1}:`,
      ...inheritedLines,
    ])
  })

  const inlineStyle = styleText(result.inlineStyle)
  if (inlineStyle) {
    appendLines(lines, ['Inline style:', inlineStyle])
  }

  const attributeStyle = styleText(result.attributesStyle)
  if (attributeStyle) {
    appendLines(lines, ['Attribute style:', attributeStyle])
  }

  const blob = lines.join('\n')
  if (blob.length <= MAX_MATCHED_CSS_LENGTH) {
    return blob
  }
  return `${blob.slice(0, MAX_MATCHED_CSS_LENGTH)}${TRUNCATION_MARKER}`
}

const matchedStylesForNode = async (
  client: CdpClient,
  sessionId: string,
  objectId: string,
): Promise<string | null> => {
  try {
    await client.send('DOM.enable', {}, sessionId)
    await client.send('CSS.enable', {}, sessionId)

    const requested = (await client.send(
      'DOM.requestNode',
      { objectId },
      sessionId,
    )) as { nodeId?: unknown }

    if (typeof requested.nodeId !== 'number') {
      return null
    }

    const matched = (await client.send(
      'CSS.getMatchedStylesForNode',
      { nodeId: requested.nodeId },
      sessionId,
    )) as MatchedStylesResult

    const serialized = serializeMatchedStyles(matched)
    return serialized.length > 0 ? serialized : null
  } catch {
    return null
  }
}

export default matchedStylesForNode
