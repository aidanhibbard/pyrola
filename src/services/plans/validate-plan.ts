const MERMAID_FENCE_RE = /```mermaid[\s\S]*?```/

export default (body: string): void => {
  if (!MERMAID_FENCE_RE.test(body.trim())) {
    throw new Error(
      'Plan body must include a ```mermaid fenced diagram (required in the Architecture section).',
    )
  }
}
