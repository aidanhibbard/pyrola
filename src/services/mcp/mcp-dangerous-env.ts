/** Env keys that must not be overlayed onto MCP stdio child processes. */
const DANGEROUS_ENV_KEYS = new Set(
  [
    'PATH',
    'PATHEXT',
    'LD_PRELOAD',
    'LD_LIBRARY_PATH',
    'LD_AUDIT',
    'DYLD_INSERT_LIBRARIES',
    'DYLD_LIBRARY_PATH',
    'DYLD_FRAMEWORK_PATH',
    'DYLD_FALLBACK_LIBRARY_PATH',
    'DYLD_FORCE_FLAT_NAMESPACE',
    'OPENSSL_CONF',
    'PYTHONPATH',
    'PYTHONHOME',
    'NODE_OPTIONS',
    'NODE_PATH',
    'BASH_ENV',
    'ENV',
    'SHELLOPTS',
    'IFS',
    'CDPATH',
    'PROMPT_COMMAND',
    'PERL5LIB',
    'PERL5OPT',
    'RUBYOPT',
    'RUBYLIB',
  ].map((key) => key.toUpperCase()),
)

export const isDangerousMcpEnvKey = (key: string): boolean => {
  const upper = key.trim().toUpperCase()
  if (upper.length === 0) {
    return true
  }
  if (DANGEROUS_ENV_KEYS.has(upper)) {
    return true
  }
  if (upper.startsWith('DYLD_') || upper.startsWith('LD_')) {
    return true
  }
  return false
}

export const assertSafeMcpEnvOverlay = (
  env: Record<string, string>,
): Record<string, string> => {
  const safe: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (isDangerousMcpEnvKey(key)) {
      throw new Error(`MCP env key "${key}" is not allowed`)
    }
    if (key.includes('\0') || value.includes('\0')) {
      throw new Error('MCP env must not contain NUL bytes')
    }
    safe[key] = value
  }
  return safe
}
