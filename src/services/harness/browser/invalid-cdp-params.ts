const describeReceived = (value: unknown): string => {
  if (value === null) {
    return 'null'
  }
  return typeof value
}

const invalidCdpParams = (
  path: string,
  received: unknown,
  example: Record<string, unknown>,
): Record<string, unknown> => ({
  error: 'invalid_cdp_params',
  path,
  expected: 'string (JavaScript source)',
  received: describeReceived(received),
  example,
})

export default invalidCdpParams
