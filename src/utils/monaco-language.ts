/** Extension / basename -> Monaco + Shiki language id. Aligned with LSP registry where practical. */

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  vue: 'vue',
  ts: 'typescript',
  tsx: 'tsx',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'jsx',
  mjs: 'javascript',
  cjs: 'javascript',
  rs: 'rust',
  json: 'json',
  jsonc: 'jsonc',
  yaml: 'yaml',
  yml: 'yaml',
  md: 'markdown',
  markdown: 'markdown',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'html',
  htm: 'html',
  py: 'python',
  pyi: 'python',
  go: 'go',
  astro: 'astro',
  svelte: 'svelte',
  zig: 'zig',
  zon: 'zig',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  m: 'objective-c',
  mm: 'objective-cpp',
  java: 'java',
  sh: 'shellscript',
  bash: 'shellscript',
  zsh: 'shellscript',
  ksh: 'shellscript',
  toml: 'toml',
  lua: 'lua',
  php: 'php',
  kt: 'kotlin',
  kts: 'kotlin',
  xml: 'xml',
  xsd: 'xml',
  xsl: 'xml',
  sql: 'sql',
  prisma: 'prisma',
  graphql: 'graphql',
  gql: 'graphql',
  tf: 'terraform',
  tfvars: 'terraform',
  dockerfile: 'dockerfile',
  rb: 'ruby',
  rake: 'ruby',
  gemspec: 'ruby',
  ru: 'ruby',
  cs: 'csharp',
  csx: 'csharp',
  swift: 'swift',
  ex: 'elixir',
  exs: 'elixir',
  hs: 'haskell',
  lhs: 'haskell',
  clj: 'clojure',
  cljs: 'clojure',
  cljc: 'clojure',
  edn: 'clojure',
  ml: 'ocaml',
  mli: 'ocaml',
  dart: 'dart',
  gleam: 'gleam',
  nix: 'nix',
  r: 'r',
  scala: 'scala',
  sc: 'scala',
  cmake: 'cmake',
  ini: 'ini',
  diff: 'diff',
  make: 'make',
  mk: 'make',
}

const BASENAME_LANGUAGE_MAP: Record<string, string> = {
  dockerfile: 'dockerfile',
  makefile: 'make',
  gnumakefile: 'make',
  'cmakelists.txt': 'cmake',
}

const pathBasename = (path: string): string => {
  const normalized = path.replace(/\\/g, '/')
  const slash = normalized.lastIndexOf('/')
  return slash >= 0 ? normalized.slice(slash + 1) : normalized
}

const pathExtension = (path: string): string | null => {
  const base = pathBasename(path)
  const dot = base.lastIndexOf('.')
  if (dot <= 0 || dot === base.length - 1) {
    return null
  }
  return base.slice(dot + 1).toLowerCase()
}

export const detectMonacoLanguage = (path: string): string => {
  const base = pathBasename(path).toLowerCase()
  const byBasename = BASENAME_LANGUAGE_MAP[base]
  if (byBasename) {
    return byBasename
  }

  const extension = pathExtension(path)
  if (!extension) {
    return 'plaintext'
  }

  return EXTENSION_LANGUAGE_MAP[extension] ?? 'plaintext'
}
