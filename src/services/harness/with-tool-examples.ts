const MAX_EXAMPLES = 1
const MAX_EXAMPLE_CHARS = 280

const formatExample = (example: Record<string, unknown>, index: number): string => {
  const body = JSON.stringify(example, null, 2)
  const truncated =
    body.length > MAX_EXAMPLE_CHARS
      ? `${body.slice(0, MAX_EXAMPLE_CHARS)}\n  ...`
      : body
  return `${index + 1}. ${truncated}`
}

export default (
  description: string,
  inputExamples: Array<Record<string, unknown>>,
): string => {
  if (inputExamples.length === 0) {
    return description
  }

  const selected = inputExamples.slice(0, MAX_EXAMPLES)
  const block = selected.map((example, index) => formatExample(example, index)).join('\n')
  return `${description}\n\nExamples:\n${block}`
}
