use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LspInstallKind {
  Npm,
  GithubRelease,
  /// Direct URL archive (tar.gz / zip / tar.xz). Used when GitHub Releases are not available.
  HttpArchive,
  /// `go install <package>` into the managed server dir (requires Go on PATH).
  GoInstall,
  ToolchainPath,
  None,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LspTier {
  A,
  B,
  C,
  D,
}

#[derive(Debug, Clone)]
pub struct NpmInstallSpec {
  pub packages: &'static [&'static str],
  /// Relative path from the managed install dir to the CLI entry (node script or bin name).
  pub bin: &'static str,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[allow(dead_code)]
pub enum GithubTargetStyle {
  /// Rust host triple, e.g. aarch64-apple-darwin
  RustTriple,
  /// Node-style, e.g. darwin-arm64
  NodeStyle,
  /// Marksman release names: macos, linux-x64, linux-arm64, or plain .exe
  Marksman,
  /// clangd release names: mac, linux, windows
  ClangdOs,
  /// zls 0.13-style: aarch64-macos, x86_64-linux, x86_64-windows
  ZigOsArch,
  /// taplo-style: darwin-aarch64, linux-x86_64, windows-x86_64
  TaploOsArch,
  /// clojure-lsp native: macos-aarch64, linux-amd64, windows-amd64
  ClojureNative,
  /// lemminx: osx-aarch_64, osx-x86_64, linux, win32
  LemminxOs,
  /// HashiCorp / Go style: darwin_arm64, linux_amd64, windows_amd64
  HashicorpOsArch,
}

#[derive(Debug, Clone)]
pub struct GithubReleaseSpec {
  pub repo: &'static str,
  pub tag: &'static str,
  /// Asset name template with `{target}` / `{version}` placeholders.
  pub asset: &'static str,
  pub binary_name: &'static str,
  pub gzip: bool,
  pub target_style: GithubTargetStyle,
}

#[derive(Debug, Clone)]
pub struct HttpArchiveSpec {
  /// URL template. May include `{version}` and `{target}` when `target_style` is set.
  pub url: &'static str,
  /// Relative path or basename to locate after extract (searched recursively if needed).
  pub binary_name: &'static str,
  /// Version key for the managed install directory (also substitutes `{version}` in url).
  pub version_key: &'static str,
  /// When set, `{target}` in `url` is replaced via `github_target_token`.
  pub target_style: Option<GithubTargetStyle>,
}

#[derive(Debug, Clone)]
pub struct GoInstallSpec {
  /// Package argument for `go install`, e.g. `golang.org/x/tools/gopls@v0.18.1`.
  pub package: &'static str,
  pub binary_name: &'static str,
  pub version_key: &'static str,
}

#[derive(Debug, Clone)]
pub struct BuiltinLspSpec {
  pub id: &'static str,
  pub command: &'static [&'static str],
  pub extensions: &'static [&'static str],
  pub language_ids: &'static [&'static str],
  pub tier: LspTier,
  pub install: LspInstallKind,
  pub npm: Option<NpmInstallSpec>,
  pub github: Option<GithubReleaseSpec>,
  pub http: Option<HttpArchiveSpec>,
  pub go: Option<GoInstallSpec>,
  pub root_markers: &'static [&'static str],
  pub requires_trust: bool,
}

#[allow(dead_code)]
pub fn builtin_specs() -> Vec<&'static BuiltinLspSpec> {
  BUILTINS.iter().collect()
}

pub fn builtin_spec_by_id(id: &str) -> Option<&'static BuiltinLspSpec> {
  BUILTINS.iter().find(|spec| spec.id == id)
}

pub fn tier_a_ids() -> Vec<&'static str> {
  BUILTINS
    .iter()
    .filter(|spec| spec.tier == LspTier::A)
    .map(|spec| spec.id)
    .collect()
}

pub fn language_id_for_extension(extension: &str) -> String {
  let ext = extension.trim_start_matches('.');
  for spec in BUILTINS {
    for (i, configured) in spec.extensions.iter().enumerate() {
      let configured = configured.trim_start_matches('.');
      if configured.eq_ignore_ascii_case(ext) {
        if let Some(lang) = spec.language_ids.get(i).or_else(|| spec.language_ids.first()) {
          return (*lang).to_string();
        }
      }
    }
  }
  match ext {
    "ts" | "tsx" => "typescript".to_string(),
    "js" | "jsx" | "mjs" | "cjs" | "mts" | "cts" => "javascript".to_string(),
    other => other.to_string(),
  }
}

fn marker_name_matches(pattern: &str, file_name: &str) -> bool {
  if !pattern.contains('*') {
    return pattern == file_name;
  }
  let parts: Vec<&str> = pattern.split('*').collect();
  if parts.len() == 2 {
    let (prefix, suffix) = (parts[0], parts[1]);
    return file_name.starts_with(prefix)
      && file_name.ends_with(suffix)
      && file_name.len() >= prefix.len() + suffix.len();
  }
  false
}

/// Lower is better. Used to break ties when multiple servers claim the same extension.
///
/// Specialized project markers (e.g. `deno.json`) outrank generic ones (`package.json`)
/// so Deno projects do not get the TypeScript server and vice versa.
pub fn root_marker_score(workspace_root: Option<&std::path::Path>, spec: &BuiltinLspSpec) -> i32 {
  let Some(root) = workspace_root else {
    return if spec.root_markers.is_empty() { 100 } else { 500 };
  };
  if spec.root_markers.is_empty() {
    return 100;
  }
  let mut best: Option<i32> = None;
  for marker in spec.root_markers {
    let matched = if marker.contains('*') {
      std::fs::read_dir(root)
        .ok()
        .map(|entries| {
          entries.flatten().any(|entry| {
            entry
              .file_name()
              .to_str()
              .map(|name| marker_name_matches(marker, name))
              .unwrap_or(false)
          })
        })
        .unwrap_or(false)
    } else {
      root.join(marker).exists()
    };
    if !matched {
      continue;
    }
    let specificity = match *marker {
      "package.json" => 50,
      _ => 0,
    };
    best = Some(best.map_or(specificity, |current| current.min(specificity)));
  }
  best.unwrap_or(1000)
}

pub fn tier_rank(tier: LspTier) -> i32 {
  match tier {
    LspTier::A => 0,
    LspTier::B => 1,
    LspTier::C => 2,
    LspTier::D => 3,
  }
}

pub fn allowlisted_lsp_basenames() -> &'static [&'static str] {
  &[
    "typescript-language-server",
    "vue-language-server",
    "vscode-json-language-server",
    "vscode-html-language-server",
    "vscode-css-language-server",
    "yaml-language-server",
    "marksman",
    "basedpyright-langserver",
    "basedpyright",
    "rust-analyzer",
    "gopls",
    "bash-language-server",
    "tailwindcss-language-server",
    "svelteserver",
    "astro-ls",
    "prisma-language-server",
    "graphql-lsp",
    "docker-langserver",
    "lua-language-server",
    "clangd",
    "terraform-ls",
    "taplo",
    "zls",
    "intelephense",
    "kotlin-language-server",
    "lemminx",
    "sql-language-server",
    "deno",
    "ruby-lsp",
    "jdtls",
    "csharp-ls",
    "omnisharp",
    "sourcekit-lsp",
    "elixir-ls",
    "haskell-language-server-wrapper",
    "clojure-lsp",
    "ocamllsp",
    "dart",
    "gleam",
    "nil",
    "nixd",
    "R",
    "metals",
    "node",
  ]
}

macro_rules! npm_spec {
  ($id:expr, $cmd:expr, $exts:expr, $langs:expr, $tier:expr, $pkgs:expr, $bin:expr, $markers:expr) => {
    BuiltinLspSpec {
      id: $id,
      command: $cmd,
      extensions: $exts,
      language_ids: $langs,
      tier: $tier,
      install: LspInstallKind::Npm,
      npm: Some(NpmInstallSpec {
        packages: $pkgs,
        bin: $bin,
      }),
      github: None,
      http: None,
      go: None,
      root_markers: $markers,
      requires_trust: false,
    }
  };
}

static BUILTINS: &[BuiltinLspSpec] = &[
  // Tier A
  npm_spec!(
    "typescript",
    &["typescript-language-server", "--stdio"],
    &[".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"],
    &["typescript", "typescriptreact", "javascript", "javascriptreact", "javascript", "javascript", "typescript", "typescript"],
    LspTier::A,
    &["typescript-language-server@4.3.3", "typescript@5.8.2"],
    "node_modules/typescript-language-server/lib/cli.mjs",
    &[
      "package.json",
      "nuxt.config.ts",
      "nuxt.config.js",
      "nuxt.config.mjs",
      "nuxt.config.cjs",
      ".nuxtrc",
      ".nuxt",
    ]
  ),
  npm_spec!(
    "vue",
    &["vue-language-server", "--stdio"],
    &[".vue"],
    &["vue"],
    LspTier::A,
    &["@vue/language-server@2.2.8", "@vue/typescript-plugin@2.2.8", "typescript@5.8.2"],
    "node_modules/@vue/language-server/bin/vue-language-server.js",
    &[
      "package.json",
      "nuxt.config.ts",
      "nuxt.config.js",
      "nuxt.config.mjs",
      "nuxt.config.cjs",
      ".nuxtrc",
      ".nuxt",
    ]
  ),
  npm_spec!(
    "json",
    &["vscode-json-language-server", "--stdio"],
    &[".json", ".jsonc"],
    &["json", "jsonc"],
    LspTier::A,
    &["vscode-langservers-extracted@4.10.0"],
    "node_modules/vscode-langservers-extracted/bin/vscode-json-language-server",
    &[]
  ),
  npm_spec!(
    "yaml",
    &["yaml-language-server", "--stdio"],
    &[".yaml", ".yml"],
    &["yaml", "yaml"],
    LspTier::A,
    &["yaml-language-server@1.17.0"],
    "node_modules/yaml-language-server/bin/yaml-language-server",
    &[]
  ),
  BuiltinLspSpec {
    id: "markdown",
    command: &["marksman", "server"],
    extensions: &[".md", ".markdown"],
    language_ids: &["markdown", "markdown"],
    tier: LspTier::A,
    install: LspInstallKind::GithubRelease,
    npm: None,
    github: Some(GithubReleaseSpec {
      repo: "artempyanykh/marksman",
      tag: "2024-12-18",
      asset: "marksman-{target}",
      binary_name: "marksman",
      gzip: false,
      target_style: GithubTargetStyle::Marksman,
    }),
    http: None,
    go: None,
    root_markers: &[],
    requires_trust: false,
  },
  // Tier B
  npm_spec!(
    "python",
    &["basedpyright-langserver", "--stdio"],
    &[".py", ".pyi"],
    &["python", "python"],
    LspTier::B,
    &["basedpyright@1.28.5"],
    "node_modules/basedpyright/langserver.index.js",
    &["pyproject.toml", "requirements.txt", "setup.py"]
  ),
  BuiltinLspSpec {
    id: "rust",
    command: &["rust-analyzer"],
    extensions: &[".rs"],
    language_ids: &["rust"],
    tier: LspTier::B,
    install: LspInstallKind::GithubRelease,
    npm: None,
    github: Some(GithubReleaseSpec {
      repo: "rust-lang/rust-analyzer",
      tag: "2025-03-10",
      asset: "rust-analyzer-{target}.gz",
      binary_name: "rust-analyzer",
      gzip: true,
      target_style: GithubTargetStyle::RustTriple,
    }),
    http: None,
    go: None,
    root_markers: &["Cargo.toml"],
    requires_trust: false,
  },
  BuiltinLspSpec {
    id: "gopls",
    command: &["gopls"],
    extensions: &[".go"],
    language_ids: &["go"],
    tier: LspTier::B,
    install: LspInstallKind::GoInstall,
    npm: None,
    github: None,
    http: None,
    go: Some(GoInstallSpec {
      package: "golang.org/x/tools/gopls@v0.18.1",
      binary_name: "gopls",
      version_key: "v0.18.1",
    }),
    root_markers: &["go.mod"],
    requires_trust: false,
  },
  npm_spec!(
    "bash",
    &["bash-language-server", "start"],
    &[".sh", ".bash", ".zsh", ".ksh"],
    &["shellscript", "shellscript", "shellscript", "shellscript"],
    LspTier::B,
    &["bash-language-server@5.4.3"],
    "node_modules/bash-language-server/out/cli.js",
    &[]
  ),
  npm_spec!(
    "html",
    &["vscode-html-language-server", "--stdio"],
    &[".html", ".htm"],
    &["html", "html"],
    LspTier::B,
    &["vscode-langservers-extracted@4.10.0"],
    "node_modules/vscode-langservers-extracted/bin/vscode-html-language-server",
    &[]
  ),
  npm_spec!(
    "css",
    &["vscode-css-language-server", "--stdio"],
    &[".css", ".scss", ".less"],
    &["css", "scss", "less"],
    LspTier::B,
    &["vscode-langservers-extracted@4.10.0"],
    "node_modules/vscode-langservers-extracted/bin/vscode-css-language-server",
    &[]
  ),
  npm_spec!(
    "tailwindcss",
    &["tailwindcss-language-server", "--stdio"],
    &[".html", ".vue", ".tsx", ".jsx", ".svelte", ".astro", ".css"],
    &["html", "vue", "typescriptreact", "javascriptreact", "svelte", "astro", "css"],
    LspTier::B,
    &["@tailwindcss/language-server@0.0.27"],
    "node_modules/@tailwindcss/language-server/bin/tailwindcss-language-server",
    &["tailwind.config.js", "tailwind.config.ts", "tailwind.config.cjs", "tailwind.config.mjs"]
  ),
  npm_spec!(
    "svelte",
    &["svelteserver", "--stdio"],
    &[".svelte"],
    &["svelte"],
    LspTier::B,
    &["svelte-language-server@0.17.10"],
    "node_modules/svelte-language-server/bin/server.js",
    &["package.json"]
  ),
  npm_spec!(
    "astro",
    &["astro-ls", "--stdio"],
    &[".astro"],
    &["astro"],
    LspTier::B,
    &["@astrojs/language-server@2.15.4"],
    "node_modules/@astrojs/language-server/bin/nodeServer.js",
    &["package.json", "astro.config.mjs", "astro.config.ts"]
  ),
  npm_spec!(
    "prisma",
    &["prisma-language-server", "--stdio"],
    &[".prisma"],
    &["prisma"],
    LspTier::B,
    &["@prisma/language-server@6.5.0"],
    "node_modules/@prisma/language-server/dist/bin.js",
    &["schema.prisma"]
  ),
  npm_spec!(
    "graphql",
    &["graphql-lsp", "server", "--method", "stream"],
    &[".graphql", ".gql"],
    &["graphql", "graphql"],
    LspTier::B,
    &["graphql-language-service-cli@3.5.0"],
    "node_modules/graphql-language-service-cli/bin/graphql.js",
    &[]
  ),
  npm_spec!(
    "dockerfile",
    &["docker-langserver", "--stdio"],
    &[".dockerfile"],
    &["dockerfile"],
    LspTier::B,
    &["dockerfile-language-server-nodejs@0.13.0"],
    "node_modules/dockerfile-language-server-nodejs/lib/server.js",
    &["Dockerfile"]
  ),
  BuiltinLspSpec {
    id: "lua",
    command: &["lua-language-server"],
    extensions: &[".lua"],
    language_ids: &["lua"],
    tier: LspTier::B,
    install: LspInstallKind::GithubRelease,
    npm: None,
    github: Some(GithubReleaseSpec {
      repo: "LuaLS/lua-language-server",
      tag: "3.13.6",
      asset: "lua-language-server-{version}-{target}.tar.gz",
      binary_name: "bin/lua-language-server",
      gzip: false,
      target_style: GithubTargetStyle::NodeStyle,
    }),
    http: None,
    go: None,
    root_markers: &[],
    requires_trust: false,
  },
  BuiltinLspSpec {
    id: "clangd",
    command: &["clangd"],
    extensions: &[".c", ".h", ".cpp", ".hpp", ".cc", ".cxx", ".m", ".mm"],
    language_ids: &["c", "c", "cpp", "cpp", "cpp", "cpp", "objective-c", "objective-cpp"],
    tier: LspTier::B,
    install: LspInstallKind::GithubRelease,
    npm: None,
    github: Some(GithubReleaseSpec {
      repo: "clangd/clangd",
      tag: "19.1.2",
      asset: "clangd-{target}-{version}.zip",
      binary_name: "clangd",
      gzip: false,
      target_style: GithubTargetStyle::ClangdOs,
    }),
    http: None,
    go: None,
    root_markers: &["compile_commands.json", "CMakeLists.txt"],
    requires_trust: false,
  },
  BuiltinLspSpec {
    id: "terraform",
    command: &["terraform-ls", "serve"],
    extensions: &[".tf", ".tfvars"],
    language_ids: &["terraform", "terraform-vars"],
    tier: LspTier::B,
    install: LspInstallKind::HttpArchive,
    npm: None,
    github: None,
    http: Some(HttpArchiveSpec {
      url: "https://releases.hashicorp.com/terraform-ls/{version}/terraform-ls_{version}_{target}.zip",
      binary_name: "terraform-ls",
      version_key: "0.36.4",
      target_style: Some(GithubTargetStyle::HashicorpOsArch),
    }),
    go: None,
    root_markers: &[],
    requires_trust: false,
  },
  BuiltinLspSpec {
    id: "toml",
    command: &["taplo", "lsp", "stdio"],
    extensions: &[".toml"],
    language_ids: &["toml"],
    tier: LspTier::B,
    install: LspInstallKind::GithubRelease,
    npm: None,
    github: Some(GithubReleaseSpec {
      repo: "tamasfe/taplo",
      tag: "0.9.3",
      asset: "taplo-full-{target}.gz",
      binary_name: "taplo",
      gzip: true,
      target_style: GithubTargetStyle::TaploOsArch,
    }),
    http: None,
    go: None,
    root_markers: &[],
    requires_trust: false,
  },
  BuiltinLspSpec {
    id: "zig",
    command: &["zls"],
    extensions: &[".zig", ".zon"],
    language_ids: &["zig", "zon"],
    tier: LspTier::B,
    install: LspInstallKind::GithubRelease,
    npm: None,
    github: Some(GithubReleaseSpec {
      repo: "zigtools/zls",
      tag: "0.13.0",
      asset: "zls-{target}.tar.xz",
      binary_name: "zls",
      gzip: false,
      target_style: GithubTargetStyle::ZigOsArch,
    }),
    http: None,
    go: None,
    root_markers: &["build.zig"],
    requires_trust: false,
  },
  npm_spec!(
    "php",
    &["intelephense", "--stdio"],
    &[".php"],
    &["php"],
    LspTier::B,
    &["intelephense@1.14.4"],
    "node_modules/intelephense/lib/intelephense.js",
    &["composer.json"]
  ),
  BuiltinLspSpec {
    id: "kotlin",
    command: &["kotlin-language-server"],
    extensions: &[".kt", ".kts"],
    language_ids: &["kotlin", "kotlin"],
    tier: LspTier::B,
    install: LspInstallKind::GithubRelease,
    npm: None,
    github: Some(GithubReleaseSpec {
      repo: "fwcd/kotlin-language-server",
      tag: "1.3.13",
      asset: "server.zip",
      binary_name: "bin/kotlin-language-server",
      gzip: false,
      target_style: GithubTargetStyle::RustTriple,
    }),
    http: None,
    go: None,
    root_markers: &["build.gradle", "build.gradle.kts", "settings.gradle"],
    requires_trust: false,
  },
  BuiltinLspSpec {
    id: "xml",
    command: &["lemminx"],
    extensions: &[".xml", ".xsd", ".xsl"],
    language_ids: &["xml", "xsd", "xsl"],
    tier: LspTier::B,
    install: LspInstallKind::GithubRelease,
    npm: None,
    github: Some(GithubReleaseSpec {
      repo: "redhat-developer/vscode-xml",
      tag: "0.29.0",
      asset: "lemminx-{target}.zip",
      binary_name: "lemminx",
      gzip: false,
      target_style: GithubTargetStyle::LemminxOs,
    }),
    http: None,
    go: None,
    root_markers: &[],
    requires_trust: false,
  },
  npm_spec!(
    "sql",
    &["sql-language-server", "up", "--method", "stdio"],
    &[".sql"],
    &["sql"],
    LspTier::B,
    &["sql-language-server@1.7.0"],
    "node_modules/sql-language-server/npm_bin/cli.js",
    &[]
  ),
  // Tier C toolchain
  BuiltinLspSpec {
    id: "deno",
    command: &["deno", "lsp"],
    extensions: &[".ts", ".tsx", ".js", ".jsx"],
    language_ids: &["typescript", "typescriptreact", "javascript", "javascriptreact"],
    tier: LspTier::C,
    install: LspInstallKind::ToolchainPath,
    npm: None,
    github: None,
    http: None,
    go: None,
    root_markers: &["deno.json", "deno.jsonc"],
    requires_trust: false,
  },
  BuiltinLspSpec {
    id: "ruby",
    command: &["ruby-lsp"],
    extensions: &[".rb", ".rake", ".gemspec", ".ru"],
    language_ids: &["ruby", "ruby", "ruby", "ruby"],
    tier: LspTier::C,
    install: LspInstallKind::ToolchainPath,
    npm: None,
    github: None,
    http: None,
    go: None,
    root_markers: &["Gemfile"],
    requires_trust: false,
  },
  BuiltinLspSpec {
    id: "java",
    command: &["jdtls"],
    extensions: &[".java"],
    language_ids: &["java"],
    tier: LspTier::B,
    install: LspInstallKind::HttpArchive,
    npm: None,
    github: None,
    http: Some(HttpArchiveSpec {
      url: "https://download.eclipse.org/jdtls/snapshots/jdt-language-server-latest.tar.gz",
      binary_name: "jdtls",
      version_key: "latest",
      target_style: None,
    }),
    go: None,
    root_markers: &["pom.xml", "build.gradle", "build.gradle.kts"],
    requires_trust: false,
  },
  BuiltinLspSpec {
    id: "csharp",
    command: &["csharp-ls"],
    extensions: &[".cs", ".csx"],
    language_ids: &["csharp", "csharp"],
    tier: LspTier::C,
    install: LspInstallKind::ToolchainPath,
    npm: None,
    github: None,
    http: None,
    go: None,
    root_markers: &["*.csproj", "*.sln"],
    requires_trust: false,
  },
  BuiltinLspSpec {
    id: "swift",
    command: &["sourcekit-lsp"],
    extensions: &[".swift"],
    language_ids: &["swift"],
    tier: LspTier::C,
    install: LspInstallKind::ToolchainPath,
    npm: None,
    github: None,
    http: None,
    go: None,
    root_markers: &["Package.swift"],
    requires_trust: false,
  },
  BuiltinLspSpec {
    id: "elixir",
    command: &["elixir-ls"],
    extensions: &[".ex", ".exs"],
    language_ids: &["elixir", "elixir"],
    tier: LspTier::C,
    install: LspInstallKind::ToolchainPath,
    npm: None,
    github: None,
    http: None,
    go: None,
    root_markers: &["mix.exs"],
    requires_trust: false,
  },
  BuiltinLspSpec {
    id: "haskell",
    command: &["haskell-language-server-wrapper", "--lsp"],
    extensions: &[".hs", ".lhs"],
    language_ids: &["haskell", "haskell"],
    tier: LspTier::C,
    install: LspInstallKind::ToolchainPath,
    npm: None,
    github: None,
    http: None,
    go: None,
    root_markers: &["stack.yaml", "cabal.project"],
    requires_trust: false,
  },
  BuiltinLspSpec {
    id: "clojure",
    command: &["clojure-lsp"],
    extensions: &[".clj", ".cljs", ".cljc", ".edn"],
    language_ids: &["clojure", "clojure", "clojure", "clojure"],
    tier: LspTier::C,
    install: LspInstallKind::GithubRelease,
    npm: None,
    github: Some(GithubReleaseSpec {
      repo: "clojure-lsp/clojure-lsp",
      tag: "2026.07.06-14.34.19",
      asset: "clojure-lsp-native-{target}.zip",
      binary_name: "clojure-lsp",
      gzip: false,
      target_style: GithubTargetStyle::ClojureNative,
    }),
    http: None,
    go: None,
    root_markers: &["deps.edn", "project.clj"],
    requires_trust: false,
  },
  BuiltinLspSpec {
    id: "ocaml",
    command: &["ocamllsp"],
    extensions: &[".ml", ".mli"],
    language_ids: &["ocaml", "ocaml"],
    tier: LspTier::C,
    install: LspInstallKind::ToolchainPath,
    npm: None,
    github: None,
    http: None,
    go: None,
    root_markers: &["dune-project"],
    requires_trust: false,
  },
  BuiltinLspSpec {
    id: "dart",
    command: &["dart", "language-server", "--protocol=lsp"],
    extensions: &[".dart"],
    language_ids: &["dart"],
    tier: LspTier::C,
    install: LspInstallKind::ToolchainPath,
    npm: None,
    github: None,
    http: None,
    go: None,
    root_markers: &["pubspec.yaml"],
    requires_trust: false,
  },
  BuiltinLspSpec {
    id: "gleam",
    command: &["gleam", "lsp"],
    extensions: &[".gleam"],
    language_ids: &["gleam"],
    tier: LspTier::C,
    install: LspInstallKind::ToolchainPath,
    npm: None,
    github: None,
    http: None,
    go: None,
    root_markers: &["gleam.toml"],
    requires_trust: false,
  },
  BuiltinLspSpec {
    id: "nix",
    command: &["nil"],
    extensions: &[".nix"],
    language_ids: &["nix"],
    tier: LspTier::C,
    install: LspInstallKind::ToolchainPath,
    npm: None,
    github: None,
    http: None,
    go: None,
    root_markers: &["flake.nix"],
    requires_trust: false,
  },
  BuiltinLspSpec {
    id: "r",
    command: &["R", "--slave", "-e", "languageserver::run()"],
    extensions: &[".r", ".R"],
    language_ids: &["r", "r"],
    tier: LspTier::C,
    install: LspInstallKind::ToolchainPath,
    npm: None,
    github: None,
    http: None,
    go: None,
    root_markers: &[],
    requires_trust: false,
  },
  BuiltinLspSpec {
    id: "scala",
    command: &["metals"],
    extensions: &[".scala", ".sc"],
    language_ids: &["scala", "scala"],
    tier: LspTier::C,
    install: LspInstallKind::ToolchainPath,
    npm: None,
    github: None,
    http: None,
    go: None,
    root_markers: &["build.sbt"],
    requires_trust: false,
  },
  // Tier D trusted project-local
  BuiltinLspSpec {
    id: "eslint",
    command: &["vscode-eslint-language-server", "--stdio"],
    extensions: &[".ts", ".tsx", ".js", ".jsx", ".vue"],
    language_ids: &["typescript", "typescriptreact", "javascript", "javascriptreact", "vue"],
    tier: LspTier::D,
    install: LspInstallKind::None,
    npm: None,
    github: None,
    http: None,
    go: None,
    root_markers: &["package.json"],
    requires_trust: true,
  },
  BuiltinLspSpec {
    id: "oxlint",
    command: &["oxlint", "--lsp"],
    extensions: &[".ts", ".tsx", ".js", ".jsx", ".vue", ".astro", ".svelte"],
    language_ids: &["typescript", "typescriptreact", "javascript", "javascriptreact", "vue", "astro", "svelte"],
    tier: LspTier::D,
    install: LspInstallKind::None,
    npm: None,
    github: None,
    http: None,
    go: None,
    root_markers: &["package.json"],
    requires_trust: true,
  },
  BuiltinLspSpec {
    id: "biome",
    command: &["biome", "lsp-proxy"],
    extensions: &[".ts", ".tsx", ".js", ".jsx", ".json", ".css"],
    language_ids: &["typescript", "typescriptreact", "javascript", "javascriptreact", "json", "css"],
    tier: LspTier::D,
    install: LspInstallKind::None,
    npm: None,
    github: None,
    http: None,
    go: None,
    root_markers: &["biome.json", "biome.jsonc"],
    requires_trust: true,
  },
];

pub fn builtin_server_map() -> HashMap<String, (Vec<String>, Vec<String>, serde_json::Value)> {
  let mut map = HashMap::new();
  for spec in BUILTINS {
    if spec.tier == LspTier::D {
      continue;
    }
    let command = spec.command.iter().map(|s| (*s).to_string()).collect();
    let extensions = spec.extensions.iter().map(|s| (*s).to_string()).collect();
    let initialization = if spec.id == "vue" {
      // typescript.tsdk is filled in at process start by build_initialization_options.
      serde_json::json!({
        "typescript": {},
        "vue": { "complete": { "codelenses": true } }
      })
    } else {
      serde_json::json!({})
    };
    map.insert(spec.id.to_string(), (command, extensions, initialization));
  }
  map
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::fs;
  use std::time::{SystemTime, UNIX_EPOCH};

  fn temp_dir(label: &str) -> std::path::PathBuf {
    let nanos = SystemTime::now()
      .duration_since(UNIX_EPOCH)
      .map(|d| d.as_nanos())
      .unwrap_or(0);
    let dir = std::env::temp_dir().join(format!("pyrola-lsp-registry-{label}-{nanos}"));
    fs::create_dir_all(&dir).unwrap();
    dir
  }

  #[test]
  fn root_marker_score_prefers_deno_json_over_package_json() {
    let dir = temp_dir("deno");
    fs::write(dir.join("package.json"), "{}").unwrap();
    fs::write(dir.join("deno.json"), "{}").unwrap();

    let typescript = builtin_spec_by_id("typescript").unwrap();
    let deno = builtin_spec_by_id("deno").unwrap();

    assert!(root_marker_score(Some(&dir), deno) < root_marker_score(Some(&dir), typescript));
    let _ = fs::remove_dir_all(&dir);
  }

  #[test]
  fn root_marker_score_prefers_typescript_without_deno_json() {
    let dir = temp_dir("node");
    fs::write(dir.join("package.json"), "{}").unwrap();

    let typescript = builtin_spec_by_id("typescript").unwrap();
    let deno = builtin_spec_by_id("deno").unwrap();

    assert!(root_marker_score(Some(&dir), typescript) < root_marker_score(Some(&dir), deno));
    let _ = fs::remove_dir_all(&dir);
  }

  #[test]
  fn root_marker_score_prefers_nuxt_config_over_generic_package_json_alone() {
    let dir = temp_dir("nuxt");
    fs::write(dir.join("package.json"), "{}").unwrap();
    fs::write(dir.join("nuxt.config.ts"), "export default {}").unwrap();

    let vue = builtin_spec_by_id("vue").unwrap();
    let deno = builtin_spec_by_id("deno").unwrap();

    assert!(root_marker_score(Some(&dir), vue) < root_marker_score(Some(&dir), deno));
    let _ = fs::remove_dir_all(&dir);
  }

  #[test]
  fn language_id_for_extension_covers_systems_langs() {
    assert_eq!(language_id_for_extension("astro"), "astro");
    assert_eq!(language_id_for_extension("zig"), "zig");
    assert_eq!(language_id_for_extension("java"), "java");
    assert_eq!(language_id_for_extension("cpp"), "cpp");
    assert_eq!(language_id_for_extension("c"), "c");
  }

  #[test]
  fn java_is_managed_http_archive_tier_b() {
    let java = builtin_spec_by_id("java").unwrap();
    assert_eq!(java.tier, LspTier::B);
    assert_eq!(java.install, LspInstallKind::HttpArchive);
    assert!(java.http.is_some());
  }

  #[test]
  fn fixed_github_asset_styles_match_release_conventions() {
    let lua = builtin_spec_by_id("lua").unwrap();
    assert_eq!(
      lua.github.as_ref().unwrap().target_style,
      GithubTargetStyle::NodeStyle
    );

    let toml = builtin_spec_by_id("toml").unwrap();
    let toml_gh = toml.github.as_ref().unwrap();
    assert_eq!(toml_gh.tag, "0.9.3");
    assert_eq!(toml_gh.target_style, GithubTargetStyle::TaploOsArch);

    let clojure = builtin_spec_by_id("clojure").unwrap();
    let clojure_gh = clojure.github.as_ref().unwrap();
    assert_eq!(clojure_gh.tag, "2026.07.06-14.34.19");
    assert_eq!(clojure_gh.target_style, GithubTargetStyle::ClojureNative);

    let xml = builtin_spec_by_id("xml").unwrap();
    assert_eq!(
      xml.github.as_ref().unwrap().target_style,
      GithubTargetStyle::LemminxOs
    );
  }

  #[test]
  fn terraform_uses_hashicorp_http_archive() {
    let terraform = builtin_spec_by_id("terraform").unwrap();
    assert_eq!(terraform.install, LspInstallKind::HttpArchive);
    let http = terraform.http.as_ref().unwrap();
    assert_eq!(http.version_key, "0.36.4");
    assert_eq!(
      http.target_style,
      Some(GithubTargetStyle::HashicorpOsArch)
    );
    assert!(http.url.contains("releases.hashicorp.com"));
  }

  #[test]
  fn gopls_uses_go_install_and_nix_is_toolchain() {
    let gopls = builtin_spec_by_id("gopls").unwrap();
    assert_eq!(gopls.install, LspInstallKind::GoInstall);
    assert!(gopls.go.is_some());

    let nix = builtin_spec_by_id("nix").unwrap();
    assert_eq!(nix.install, LspInstallKind::ToolchainPath);
    assert!(nix.github.is_none());
  }

  #[test]
  fn tier_rank_orders_a_before_c() {
    assert!(tier_rank(LspTier::A) < tier_rank(LspTier::C));
  }
}
