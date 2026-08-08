const SERVER_ICON_FILES: Record<string, string> = {
  typescript: 'index.ts',
  vue: 'App.vue',
  json: 'data.json',
  yaml: 'config.yaml',
  markdown: 'README.md',
  python: 'main.py',
  rust: 'main.rs',
  gopls: 'main.go',
  bash: 'script.sh',
  html: 'index.html',
  css: 'styles.css',
  tailwindcss: 'tailwind.config.js',
  svelte: 'App.svelte',
  astro: 'index.astro',
  prisma: 'schema.prisma',
  graphql: 'schema.graphql',
  dockerfile: 'Dockerfile',
  lua: 'init.lua',
  clangd: 'main.c',
  terraform: 'main.tf',
  toml: 'Cargo.toml',
  zig: 'main.zig',
  php: 'index.php',
  kotlin: 'Main.kt',
  xml: 'data.xml',
  sql: 'query.sql',
  java: 'Main.java',
  deno: 'deno.json',
  'ruby-lsp': 'app.rb',
  'sourcekit-lsp': 'App.swift',
  hls: 'Main.hs',
  eslint: 'eslint.config.js',
  oxlint: 'oxlint.json',
  biome: 'biome.json',
  csharp: 'Program.cs',
  elixir: 'lib.ex',
  clojure: 'core.clj',
  ocaml: 'main.ml',
  dart: 'main.dart',
  gleam: 'main.gleam',
  nix: 'flake.nix',
  r: 'script.R',
  scala: 'Main.scala',
}

export default (serverId: string, extensions: string[]): string => {
  const mapped = SERVER_ICON_FILES[serverId]
  if (mapped) {
    return mapped
  }

  const extension = extensions[0]?.trim()
  if (!extension) {
    return 'file.txt'
  }

  const withDot = extension.startsWith('.') ? extension : `.${extension}`
  return `file${withDot}`
}
