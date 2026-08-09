use std::collections::HashMap;
use std::path::Path;
use std::process::Stdio;
use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::sync::{oneshot, Mutex};
use tokio::time::{sleep, Duration};

use super::config::{load_lsp_config, workspace_is_trusted};
use super::fs::{canonical_project_root, resolve_workspace_path};
use super::lsp_install::{
  ensure_portable_node, ensure_server_installed, find_node_bin, install_source_label,
  managed_bin_path, managed_typescript_lib, managed_vue_plugin_path, managed_vue_typescript_lib,
  remove_managed_install,
};
use super::lsp_registry::{
  allowlisted_lsp_basenames, builtin_server_map, builtin_spec_by_id, builtin_specs,
  language_id_for_extension, root_marker_score, tier_rank, BuiltinLspSpec, LspInstallKind,
};
use super::registry::{get_active_project, registry_list_projects};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LspServerStatus {
  pub id: String,
  pub running: bool,
  pub error: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub source: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub install_state: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LspCatalogEntry {
  pub id: String,
  pub label: String,
  pub extensions: Vec<String>,
  pub install_kind: String,
  pub requires_trust: bool,
  pub installable: bool,
  pub installed: bool,
  pub running: bool,
  pub disabled: bool,
  pub error: Option<String>,
  pub source: Option<String>,
  pub install_state: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LspDiagnosticsEvent {
  uri: String,
  diagnostics: serde_json::Value,
  server_id: String,
}

#[derive(Clone)]
struct LspServerEntry {
  command: Vec<String>,
  extensions: Vec<String>,
  env: HashMap<String, String>,
  initialization: serde_json::Value,
}

struct LspProcess {
  child: Child,
  stdin: ChildStdin,
  workspace_root: String,
  open_documents: HashMap<String, i32>,
  diagnostics_by_uri: HashMap<String, serde_json::Value>,
  pending: Mutex<HashMap<u64, oneshot::Sender<serde_json::Value>>>,
  next_id: Mutex<u64>,
}

struct ManagedLspServer {
  process: Arc<Mutex<LspProcess>>,
  restart: Mutex<bool>,
}

lazy_static::lazy_static! {
  static ref LSP_SERVERS: Mutex<HashMap<String, Arc<ManagedLspServer>>> = Mutex::new(HashMap::new());
  static ref LSP_STATES: Mutex<HashMap<String, LspServerStatus>> = Mutex::new(HashMap::new());
}

async fn set_state(
  id: &str,
  running: bool,
  error: Option<String>,
  source: Option<String>,
  install_state: Option<String>,
) {
  let mut states = LSP_STATES.lock().await;
  let existing = states.get(id).cloned();
  states.insert(
    id.to_string(),
    LspServerStatus {
      id: id.to_string(),
      running,
      error,
      source: source.or(existing.as_ref().and_then(|s| s.source.clone())),
      install_state: install_state.or(existing.as_ref().and_then(|s| s.install_state.clone())),
    },
  );
}

fn server_display_label(id: &str) -> String {
  match id {
    "typescript" => "TypeScript / JavaScript".to_string(),
    "vue" => "Vue / Nuxt".to_string(),
    "json" => "JSON".to_string(),
    "yaml" => "YAML".to_string(),
    "markdown" => "Markdown".to_string(),
    "python" => "Python".to_string(),
    "rust" => "Rust".to_string(),
    "gopls" => "Go".to_string(),
    "bash" => "Bash".to_string(),
    "html" => "HTML".to_string(),
    "css" => "CSS".to_string(),
    "tailwindcss" => "Tailwind CSS".to_string(),
    "svelte" => "Svelte".to_string(),
    "astro" => "Astro".to_string(),
    "prisma" => "Prisma".to_string(),
    "graphql" => "GraphQL".to_string(),
    "dockerfile" => "Dockerfile".to_string(),
    "lua" => "Lua".to_string(),
    "clangd" => "C / C++".to_string(),
    "terraform" => "Terraform".to_string(),
    "toml" => "TOML".to_string(),
    "zig" => "Zig".to_string(),
    "php" => "PHP".to_string(),
    "kotlin" => "Kotlin".to_string(),
    "xml" => "XML".to_string(),
    "sql" => "SQL".to_string(),
    "java" => "Java".to_string(),
    "eslint" => "ESLint".to_string(),
    "oxlint" => "Oxlint".to_string(),
    "biome" => "Biome".to_string(),
    "deno" => "Deno".to_string(),
    "ruby-lsp" => "Ruby".to_string(),
    "sourcekit-lsp" => "Swift".to_string(),
    "hls" => "Haskell".to_string(),
    other => other
      .split(|c| c == '-' || c == '_')
      .filter(|part| !part.is_empty())
      .map(|part| {
        let mut chars = part.chars();
        match chars.next() {
          None => String::new(),
          Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        }
      })
      .collect::<Vec<_>>()
      .join(" "),
  }
}

fn install_kind_label(kind: LspInstallKind) -> &'static str {
  match kind {
    LspInstallKind::Npm => "npm",
    LspInstallKind::GithubRelease => "github",
    LspInstallKind::HttpArchive => "http",
    LspInstallKind::GoInstall => "go",
    LspInstallKind::ToolchainPath => "toolchain",
    LspInstallKind::None => "none",
  }
}

fn is_managed_install_kind(kind: LspInstallKind) -> bool {
  matches!(
    kind,
    LspInstallKind::Npm
      | LspInstallKind::GithubRelease
      | LspInstallKind::HttpArchive
      | LspInstallKind::GoInstall
  )
}

fn builtin_lsp_servers() -> HashMap<String, LspServerEntry> {
  let mut servers = HashMap::new();
  for (id, (command, extensions, initialization)) in builtin_server_map() {
    servers.insert(
      id,
      LspServerEntry {
        command,
        extensions,
        env: HashMap::new(),
        initialization,
      },
    );
  }
  servers
}

fn parse_server_entry(value: &serde_json::Value) -> Option<LspServerEntry> {
  let object = value.as_object()?;

  if object.get("disabled").and_then(|v| v.as_bool()).unwrap_or(false) {
    return None;
  }

  let command = object
    .get("command")
    .and_then(|v| v.as_array())
    .map(|items| {
      items
        .iter()
        .filter_map(|item| item.as_str().map(str::to_string))
        .collect::<Vec<_>>()
    })
    .filter(|items| !items.is_empty())?;

  let extensions = object
    .get("extensions")
    .and_then(|v| v.as_array())
    .map(|items| {
      items
        .iter()
        .filter_map(|item| item.as_str().map(str::to_string))
        .collect::<Vec<_>>()
    })
    .unwrap_or_default();

  let env = object
    .get("env")
    .and_then(|v| v.as_object())
    .map(|entries| {
      entries
        .iter()
        .filter_map(|(key, value)| value.as_str().map(|v| (key.clone(), v.to_string())))
        .collect::<HashMap<_, _>>()
    })
    .unwrap_or_default();

  let initialization = object
    .get("initialization")
    .cloned()
    .unwrap_or(serde_json::json!({}));

  Some(LspServerEntry {
    command,
    extensions,
    env,
    initialization,
  })
}

fn resolve_lsp_servers(raw: &serde_json::Value, base: Option<HashMap<String, LspServerEntry>>) -> Option<HashMap<String, LspServerEntry>> {
  if raw.is_boolean() {
    return if raw.as_bool().unwrap_or(false) {
      Some(base.unwrap_or_else(builtin_lsp_servers))
    } else {
      None
    };
  }

  if let Some(object) = raw.as_object() {
    if object.is_empty() {
      return base.or_else(|| Some(builtin_lsp_servers()));
    }

    let mut servers = base.unwrap_or_else(builtin_lsp_servers);

    for (id, value) in object {
      if value
        .get("disabled")
        .and_then(|disabled| disabled.as_bool())
        .unwrap_or(false)
      {
        servers.remove(id);
        continue;
      }

      if let Some(entry) = parse_server_entry(value) {
        if let Some(existing) = servers.get_mut(id) {
          if !entry.command.is_empty() {
            existing.command = entry.command;
          }
          if !entry.extensions.is_empty() {
            existing.extensions = entry.extensions;
          }
          if !entry.env.is_empty() {
            existing.env.extend(entry.env);
          }
          if entry.initialization != serde_json::json!({}) {
            existing.initialization = entry.initialization;
          }
        } else {
          servers.insert(id.clone(), entry);
        }
      }
    }

    return Some(servers);
  }

  base
}

fn normalize_extension(extension: &str) -> String {
  let trimmed = extension.trim();
  if trimmed.is_empty() {
    return String::new();
  }
  if trimmed.starts_with('.') {
    trimmed.to_string()
  } else {
    format!(".{trimmed}")
  }
}

fn extension_matches(entry: &LspServerEntry, extension: &str) -> bool {
  let normalized = normalize_extension(extension);
  if normalized.is_empty() {
    return false;
  }

  entry.extensions.iter().any(|configured| {
    configured == &normalized
      || configured.trim_start_matches('.').eq_ignore_ascii_case(extension.trim_start_matches('.'))
  })
}

fn server_binary_available(app: &AppHandle, server_id: &str, entry: &LspServerEntry) -> bool {
  if let Some(spec) = builtin_spec_by_id(server_id) {
    if managed_bin_path(app, spec).is_some() {
      return true;
    }
  }
  let Some(program) = entry.command.first() else {
    return false;
  };
  if is_absolute_program(program) {
    return Path::new(program).is_file();
  }
  which::which(program).is_ok()
}

fn find_server_for_extension(
  app: &AppHandle,
  servers: &HashMap<String, LspServerEntry>,
  extension: &str,
  workspace_root: Option<&str>,
) -> Option<(String, LspServerEntry)> {
  let root_path = workspace_root.map(Path::new);
  let mut candidates: Vec<(String, LspServerEntry)> = servers
    .iter()
    .filter(|(_, entry)| extension_matches(entry, extension))
    .map(|(id, entry)| (id.clone(), entry.clone()))
    .collect();

  if candidates.is_empty() {
    return None;
  }

  candidates.sort_by(|(id_a, entry_a), (id_b, entry_b)| {
    let spec_a = builtin_spec_by_id(id_a);
    let spec_b = builtin_spec_by_id(id_b);

    let marker_a = spec_a
      .map(|spec| root_marker_score(root_path, spec))
      .unwrap_or(100);
    let marker_b = spec_b
      .map(|spec| root_marker_score(root_path, spec))
      .unwrap_or(100);

    let tier_a = spec_a.map(|spec| tier_rank(spec.tier)).unwrap_or(99);
    let tier_b = spec_b.map(|spec| tier_rank(spec.tier)).unwrap_or(99);

    let available_a = if server_binary_available(app, id_a, entry_a) {
      0
    } else {
      1
    };
    let available_b = if server_binary_available(app, id_b, entry_b) {
      0
    } else {
      1
    };

    marker_a
      .cmp(&marker_b)
      .then(tier_a.cmp(&tier_b))
      .then(available_a.cmp(&available_b))
      .then(id_a.cmp(id_b))
  });

  candidates.into_iter().next()
}

fn active_project_root(app: &AppHandle) -> Option<String> {
  let project_id = get_active_project(app.clone()).ok()??;
  let projects = registry_list_projects(app.clone()).ok()?;
  projects
    .into_iter()
    .find(|project| project.id == project_id)
    .map(|project| project.root_path)
}

async fn load_effective_servers(app: &AppHandle) -> Result<HashMap<String, LspServerEntry>, String> {
  let personal = load_lsp_config(app)?;
  let personal_effective = if personal.is_null() || personal.as_object().is_some_and(|o| o.is_empty()) {
    serde_json::json!(true)
  } else {
    personal
  };

  resolve_lsp_servers(&personal_effective, None).ok_or_else(|| {
    "LSP disabled via lsp.json (set to false). Remove that override or enable individual servers."
      .to_string()
  })
}

fn path_to_uri(path: &Path) -> String {
  let mut normalized = path.to_string_lossy().replace('\\', "/");
  if !normalized.starts_with('/') {
    normalized = format!("/{normalized}");
  }
  format!("file://{normalized}")
}

fn is_absolute_program(program: &str) -> bool {
  Path::new(program).is_absolute()
    || (cfg!(windows)
      && program.len() > 2
      && program.as_bytes()[1] == b':'
      && (program.as_bytes()[2] == b'\\' || program.as_bytes()[2] == b'/'))
}

fn is_allowlisted_basename(program: &str) -> bool {
  let name = Path::new(program)
    .file_name()
    .and_then(|n| n.to_str())
    .unwrap_or(program);
  let lower = name.to_ascii_lowercase();
  allowlisted_lsp_basenames()
    .iter()
    .any(|allowed| *allowed == lower || format!("{allowed}.exe") == lower)
}

#[derive(Debug, Clone)]
struct ResolvedLspCommand {
  program: String,
  args: Vec<String>,
  source: String,
}

/// Resolve LSP binary: personal absolute override > managed cache > PATH allowlist > project bins if trusted.
fn resolve_lsp_command(
  app: &AppHandle,
  server_id: &str,
  entry: &LspServerEntry,
  workspace_root: &str,
  trusted: bool,
) -> Result<ResolvedLspCommand, String> {
  let program = entry
    .command
    .first()
    .cloned()
    .ok_or_else(|| "LSP command missing".to_string())?;
  let args = entry.command.iter().skip(1).cloned().collect::<Vec<_>>();

  if is_absolute_program(&program) {
    if Path::new(&program).is_file() {
      return Ok(ResolvedLspCommand {
        program,
        args,
        source: "personal".to_string(),
      });
    }
    return Err(format!("LSP binary not found: {program}"));
  }

  if program.contains('/') || program.contains('\\') {
    if !trusted {
      return Err(
        "Project-relative LSP commands require a trusted workspace".to_string(),
      );
    }
    let candidate = Path::new(workspace_root).join(&program);
    if candidate.is_file() {
      return Ok(ResolvedLspCommand {
        program: candidate.to_string_lossy().replace('\\', "/"),
        args,
        source: "project".to_string(),
      });
    }
  }

  if let Some(spec) = builtin_spec_by_id(server_id) {
    if let Some(managed) = managed_bin_path(app, spec) {
      // npm packages are node scripts; spawn via node
      if spec.npm.is_some() {
        let node = find_node_bin(app)
          .map(|p| p.to_string_lossy().replace('\\', "/"))
          .or_else(|| which::which("node").ok().map(|p| p.to_string_lossy().replace('\\', "/")))
          .ok_or_else(|| {
            "Node.js is required for this language server. Enable auto-download or install Node."
              .to_string()
          })?;
        let mut node_args = vec![managed.to_string_lossy().replace('\\', "/")];
        node_args.extend(args);
        return Ok(ResolvedLspCommand {
          program: node,
          args: node_args,
          source: "managed".to_string(),
        });
      }
      return Ok(ResolvedLspCommand {
        program: managed.to_string_lossy().replace('\\', "/"),
        args,
        source: "managed".to_string(),
      });
    }
  }

  if is_allowlisted_basename(&program) {
    if let Ok(path) = which::which(&program) {
      return Ok(ResolvedLspCommand {
        program: path.to_string_lossy().replace('\\', "/"),
        args,
        source: "path".to_string(),
      });
    }
  } else if !trusted {
    return Err(format!(
      "LSP command '{program}' is not allowlisted. Trust the workspace or use a managed/default server."
    ));
  }

  if trusted {
    let local = Path::new(workspace_root)
      .join("node_modules/.bin")
      .join(&program);
    if local.is_file() {
      return Ok(ResolvedLspCommand {
        program: local.to_string_lossy().replace('\\', "/"),
        args,
        source: "project".to_string(),
      });
    }
  }

  Err(format!(
    "LSP server '{server_id}' is not installed yet. {}",
    match builtin_spec_by_id(server_id).map(|spec| spec.install) {
      Some(LspInstallKind::ToolchainPath) => {
        format!("Install `{program}` on PATH, or configure lsp.servers.{server_id}.command.")
      }
      Some(LspInstallKind::None) => {
        "This server is project-local. Trust the workspace and install it there.".to_string()
      }
      _ => "Enable lsp.autoDownload or install the binary.".to_string(),
    }
  ))
}

fn typescript_tsdk_path(app: &AppHandle, workspace_root: &str, trusted: bool) -> String {
  if trusted {
    let project = Path::new(workspace_root).join("node_modules/typescript/lib");
    if project.is_dir() {
      return project.to_string_lossy().replace('\\', "/");
    }
  }
  if let Some(managed) = managed_typescript_lib(app) {
    return managed.to_string_lossy().replace('\\', "/");
  }
  // Vue managed install also ships typescript after we added it as a dependency.
  if let Some(vue_ts) = managed_vue_typescript_lib(app) {
    return vue_ts.to_string_lossy().replace('\\', "/");
  }
  Path::new(workspace_root)
    .join("node_modules/typescript/lib")
    .to_string_lossy()
    .replace('\\', "/")
}

fn build_initialization_options(
  app: &AppHandle,
  server_id: &str,
  base: &serde_json::Value,
  workspace_root: &str,
  trusted: bool,
) -> serde_json::Value {
  let mut base = if base.is_null() {
    serde_json::json!({})
  } else {
    base.clone()
  };

  if server_id == "typescript" {
    let plugin_path = if trusted {
      let language_server = Path::new(workspace_root).join("node_modules/@vue/language-server");
      if language_server.is_dir() {
        Some(language_server)
      } else {
        let project = Path::new(workspace_root).join("node_modules/@vue/typescript-plugin");
        if project.is_dir() {
          Some(project)
        } else {
          managed_vue_plugin_path(app)
        }
      }
    } else {
      managed_vue_plugin_path(app)
    };

    if let Some(plugin_path) = plugin_path {
      let location = plugin_path.to_string_lossy().replace('\\', "/");
      let plugins = serde_json::json!([{
        "name": "@vue/typescript-plugin",
        "location": location,
        "languages": ["vue"],
        "configNamespace": "typescript",
      }]);
      if let Some(obj) = base.as_object_mut() {
        if !obj.contains_key("plugins") {
          obj.insert("plugins".to_string(), plugins);
        }
      } else {
        base = serde_json::json!({ "plugins": plugins });
      }
    }
  }

  // @vue/language-server v3: typescript.tsdk init option was dropped; pass --tsdk.
  // Prefer the TypeScript bundled with the managed Vue server over the
  // workspace copy (this repo may be on TS 6 while the language server
  // expects the TS 5.x it was installed with).
  if server_id == "vue" {
    let tsdk = managed_vue_typescript_lib(app)
      .map(|path| path.to_string_lossy().replace('\\', "/"))
      .unwrap_or_else(|| typescript_tsdk_path(app, workspace_root, trusted));
    if let Some(obj) = base.as_object_mut() {
      let typescript = obj
        .entry("typescript")
        .or_insert_with(|| serde_json::json!({}));
      if let Some(ts_obj) = typescript.as_object_mut() {
        ts_obj.insert("tsdk".to_string(), serde_json::json!(tsdk));
      } else {
        *typescript = serde_json::json!({ "tsdk": tsdk });
      }
    } else {
      base = serde_json::json!({
        "typescript": { "tsdk": tsdk }
      });
    }
  }

  base
}

fn inject_vue_tsdk_arg(
  app: &AppHandle,
  server_id: &str,
  workspace_root: &str,
  trusted: bool,
  resolved: &mut ResolvedLspCommand,
) {
  if server_id != "vue" {
    return;
  }
  if resolved
    .args
    .iter()
    .any(|arg| arg == "--tsdk" || arg.starts_with("--tsdk="))
  {
    return;
  }
  let tsdk = managed_vue_typescript_lib(app)
    .map(|path| path.to_string_lossy().replace('\\', "/"))
    .unwrap_or_else(|| typescript_tsdk_path(app, workspace_root, trusted));
  resolved.args.push(format!("--tsdk={tsdk}"));
}

fn workspace_configuration_response(
  app: &AppHandle,
  message: &serde_json::Value,
  workspace_root: &str,
  trusted: bool,
) -> serde_json::Value {
  let items = message
    .get("params")
    .and_then(|params| params.get("items"))
    .and_then(|items| items.as_array());

  let Some(items) = items else {
    return serde_json::json!([]);
  };

  let tsdk = typescript_tsdk_path(app, workspace_root, trusted);
  let typescript_config = serde_json::json!({
    "tsdk": tsdk,
    "preferences": {
      "importModuleSpecifier": "relative",
      "quotePreference": "single",
    }
  });

  let configs = items
    .iter()
    .map(|item| {
      let section = item
        .get("section")
        .and_then(|value| value.as_str())
        .unwrap_or_default();
      match section {
        "typescript" | "javascript" => typescript_config.clone(),
        "vue" => serde_json::json!({
          "complete": { "codelenses": true }
        }),
        _ => serde_json::json!({}),
      }
    })
    .collect::<Vec<_>>();

  serde_json::json!(configs)
}

async fn write_lsp_message(stdin: &mut ChildStdin, body: &serde_json::Value) -> Result<(), String> {
  let bytes = serde_json::to_vec(body).map_err(|error| error.to_string())?;
  let header = format!("Content-Length: {}\r\n\r\n", bytes.len());
  stdin
    .write_all(header.as_bytes())
    .await
    .map_err(|error| error.to_string())?;
  stdin
    .write_all(&bytes)
    .await
    .map_err(|error| error.to_string())?;
  stdin.flush().await.map_err(|error| error.to_string())
}

async fn read_lsp_message(reader: &mut BufReader<ChildStdout>) -> Result<serde_json::Value, String> {
  let mut header = Vec::new();
  let mut byte = [0u8; 1];

  loop {
    reader
      .read_exact(&mut byte)
      .await
      .map_err(|error| error.to_string())?;
    header.push(byte[0]);
    if header.len() >= 4 && header.ends_with(b"\r\n\r\n") {
      break;
    }
    if header.len() > 8192 {
      return Err("Invalid LSP header".to_string());
    }
  }

  let header_text = String::from_utf8_lossy(&header);
  let mut content_length = None;
  for line in header_text.lines() {
    if let Some((key, value)) = line.split_once(':') {
      if key.trim().eq_ignore_ascii_case("Content-Length") {
        content_length = value.trim().parse::<usize>().ok();
      }
    }
  }

  let content_length = content_length.ok_or_else(|| "Missing Content-Length header".to_string())?;
  let mut body = vec![0u8; content_length];
  reader
    .read_exact(&mut body)
    .await
    .map_err(|error| error.to_string())?;
  serde_json::from_slice(&body).map_err(|error| error.to_string())
}

async fn send_notification(
  process: &Mutex<LspProcess>,
  method: &str,
  params: serde_json::Value,
) -> Result<(), String> {
  let message = serde_json::json!({
    "jsonrpc": "2.0",
    "method": method,
    "params": params,
  });

  let mut guard = process.lock().await;
  write_lsp_message(&mut guard.stdin, &message).await
}

fn tsserver_request_body(result: serde_json::Value) -> serde_json::Value {
  result
    .get("body")
    .cloned()
    .unwrap_or(result)
}

/// Vue LS / vscode-jsonrpc sends array notification params wrapped as a single
/// positional argument: `[[id, command, args]]`. Nvim unwraps the same way.
fn unwrap_tsserver_request_tuple(params: &serde_json::Value) -> Option<&[serde_json::Value]> {
  let outer = params.as_array()?;
  if outer.len() == 1 {
    if let Some(inner) = outer[0].as_array() {
      return Some(inner.as_slice());
    }
  }
  Some(outer.as_slice())
}

/// Vue language server v3 hybrid mode: forward `tsserver/request` notifications to
/// typescript-language-server via `typescript.tsserverRequest`, then reply with
/// `tsserver/response`. Without this bridge, Vue features that call into TS hang.
async fn forward_vue_tsserver_request(
  app: &AppHandle,
  vue_process: Arc<Mutex<LspProcess>>,
  params: serde_json::Value,
) {
  let Some(items) = unwrap_tsserver_request_tuple(&params) else {
    return;
  };
  let Some(request_id) = items.first().cloned() else {
    return;
  };
  let command = items
    .get(1)
    .and_then(|value| value.as_str())
    .unwrap_or_default()
    .to_string();
  let args = items
    .get(2)
    .cloned()
    .unwrap_or(serde_json::Value::Null);

  let body = match forward_vue_tsserver_request_inner(app, &vue_process, &command, args).await {
    Ok(value) => tsserver_request_body(value),
    Err(_) => serde_json::Value::Null,
  };

  // Match Vue/vscode-jsonrpc array-param wrapping used on the request path.
  let _ = send_notification(
    &vue_process,
    "tsserver/response",
    serde_json::json!([[request_id, body]]),
  )
  .await;
}

async fn forward_vue_tsserver_request_inner(
  app: &AppHandle,
  vue_process: &Mutex<LspProcess>,
  command: &str,
  args: serde_json::Value,
) -> Result<serde_json::Value, String> {
  if command.is_empty() {
    return Err("empty tsserver command".to_string());
  }

  let workspace_root = {
    let guard = vue_process.lock().await;
    guard.workspace_root.clone()
  };

  let execute = |process: Arc<Mutex<LspProcess>>, command: String, args: serde_json::Value| async move {
    json_rpc_request(
      &process,
      "workspace/executeCommand",
      serde_json::json!({
        "command": "typescript.tsserverRequest",
        "arguments": [command, args]
      }),
    )
    .await
  };

  let _ = ensure_running_server(app, "ts", Some(workspace_root.clone())).await?;

  let ts_managed = {
    let servers = LSP_SERVERS.lock().await;
    servers.get("typescript").cloned()
  }
  .ok_or_else(|| "TypeScript language server is not running".to_string())?;

  match execute(ts_managed.process.clone(), command.to_string(), args.clone()).await {
    Ok(value) => Ok(value),
    Err(error) => {
      let lower = error.to_ascii_lowercase();
      let needs_restart = lower.contains("unknown command")
        || lower.contains("tsserverrequest")
        || lower.contains("method not found");
      if !needs_restart {
        return Err(error);
      }

      // Old typescript-language-server builds lack typescript.tsserverRequest.
      stop_server_internal("typescript").await.ok();
      let _ = ensure_running_server(app, "ts", Some(workspace_root)).await?;
      let ts_managed = {
        let servers = LSP_SERVERS.lock().await;
        servers.get("typescript").cloned()
      }
      .ok_or_else(|| "TypeScript language server is not running".to_string())?;
      execute(ts_managed.process.clone(), command.to_string(), args).await
    }
  }
}

async fn mirror_vue_document_to_typescript(
  app: &AppHandle,
  workspace_root: &str,
  path: &str,
  content: Option<&str>,
  op: &str,
) {
  let ts_status = ensure_running_server(app, "ts", Some(workspace_root.to_string())).await;
  if ts_status.map(|status| status.running).unwrap_or(false) == false {
    return;
  }

  let Some(ts_managed) = ({
    let servers = LSP_SERVERS.lock().await;
    servers.get("typescript").cloned()
  }) else {
    return;
  };

  match op {
    "open" | "change" => {
      if let Some(text) = content {
        let _ =
          sync_document_change_with_content(&ts_managed.process, workspace_root, path, text).await;
      } else {
        let _ = ensure_document_open(&ts_managed.process, workspace_root, path, None).await;
      }
    }
    "close" => {
      if let Ok(absolute) = resolve_workspace_path(workspace_root, path) {
        let uri = path_to_uri(&absolute);
        let _ = close_document(&ts_managed.process, &uri).await;
      }
    }
    _ => {}
  }
}

async fn json_rpc_request(
  process: &Mutex<LspProcess>,
  method: &str,
  params: serde_json::Value,
) -> Result<serde_json::Value, String> {
  let timeout_secs = match method {
    "textDocument/hover"
    | "textDocument/definition"
    | "textDocument/references"
    | "textDocument/completion"
    | "textDocument/documentSymbol"
    | "workspace/symbol" => 12u64,
    _ => 30u64,
  };

  let id = {
    let guard = process.lock().await;
    let mut next = guard.next_id.lock().await;
    *next += 1;
    *next
  };

  let (tx, rx) = oneshot::channel();
  {
    let guard = process.lock().await;
    guard.pending.lock().await.insert(id, tx);
  }

  let message = serde_json::json!({
    "jsonrpc": "2.0",
    "id": id,
    "method": method,
    "params": params,
  });

  {
    let mut guard = process.lock().await;
    write_lsp_message(&mut guard.stdin, &message).await?;
  }

  let response = match tokio::time::timeout(Duration::from_secs(timeout_secs), rx).await {
    Ok(Ok(response)) => response,
    Ok(Err(_)) => return Err("LSP request cancelled".to_string()),
    Err(_) => {
      let guard = process.lock().await;
      guard.pending.lock().await.remove(&id);
      return Err(format!(
        "LSP request timed out after {timeout_secs}s ({method})"
      ));
    }
  };

  if let Some(error) = response.get("error") {
    let message = error
      .get("message")
      .and_then(|value| value.as_str())
      .unwrap_or("LSP request failed");
    let code = error
      .get("code")
      .and_then(|value| value.as_i64())
      .map(|code| format!(" (code {code})"))
      .unwrap_or_default();
    return Err(format!("{message}{code}"));
  }

  Ok(response.get("result").cloned().unwrap_or(serde_json::Value::Null))
}

async fn respond_to_server_request(
  process: &Mutex<LspProcess>,
  id: &serde_json::Value,
  result: serde_json::Value,
) -> Result<(), String> {
  let message = serde_json::json!({
    "jsonrpc": "2.0",
    "id": id,
    "result": result,
  });
  let mut guard = process.lock().await;
  write_lsp_message(&mut guard.stdin, &message).await
}

fn spawn_reader(process: Arc<Mutex<LspProcess>>, server_id: String, app: AppHandle) {
  tokio::spawn(async move {
    let stdout = {
      let mut guard = process.lock().await;
      guard.child.stdout.take()
    };

    let Some(stdout) = stdout else {
      return;
    };

    let mut reader = BufReader::new(stdout);
    loop {
      let message = match read_lsp_message(&mut reader).await {
        Ok(message) => message,
        Err(_) => break,
      };

      if message.get("id").is_some() && message.get("method").is_some() {
        let id = message.get("id").cloned().unwrap_or(serde_json::Value::Null);
        let method = message
          .get("method")
          .and_then(|value| value.as_str())
          .unwrap_or_default();
        let workspace_root = {
          let guard = process.lock().await;
          guard.workspace_root.clone()
        };
        let trusted = workspace_is_trusted(&app, Some(workspace_root.as_str()));
        let result = match method {
          "window/workDoneProgress/create" => serde_json::json!(null),
          "client/registerCapability" => serde_json::json!(null),
          "workspace/configuration" => {
            workspace_configuration_response(&app, &message, &workspace_root, trusted)
          }
          _ => serde_json::json!(null),
        };
        let _ = respond_to_server_request(&process, &id, result).await;
        continue;
      }

      if message.get("id").is_none() {
        if let Some(method) = message.get("method").and_then(|value| value.as_str()) {
          if method == "tsserver/request" && server_id == "vue" {
            let params = message
              .get("params")
              .cloned()
              .unwrap_or(serde_json::Value::Null);
            let vue_process = process.clone();
            let app_handle = app.clone();
            tokio::spawn(async move {
              forward_vue_tsserver_request(&app_handle, vue_process, params).await;
            });
            continue;
          }

          if method == "textDocument/publishDiagnostics" {
            let params = message
              .get("params")
              .cloned()
              .unwrap_or(serde_json::Value::Null);
            let uri = params
              .get("uri")
              .and_then(|value| value.as_str())
              .unwrap_or_default()
              .to_string();
            let diagnostics = params
              .get("diagnostics")
              .cloned()
              .unwrap_or_else(|| serde_json::json!([]));
            {
              let mut guard = process.lock().await;
              guard
                .diagnostics_by_uri
                .insert(uri.clone(), diagnostics.clone());
            }
            let payload = LspDiagnosticsEvent {
              uri,
              diagnostics,
              server_id: server_id.clone(),
            };
            let _ = app.emit("lsp://diagnostics", payload);
          }
          continue;
        }
      }

      if let Some(id) = message
        .get("id")
        .and_then(|value| value.as_u64().or_else(|| value.as_i64().and_then(|v| u64::try_from(v).ok())))
      {
        let sender = {
          let guard = process.lock().await;
          let mut pending = guard.pending.lock().await;
          pending.remove(&id)
        };
        if let Some(sender) = sender {
          let _ = sender.send(message);
        }
      }
    }

    set_state(
      &server_id,
      false,
      Some("Language server exited".to_string()),
      None,
      Some("exited".to_string()),
    )
    .await;
    let mut servers = LSP_SERVERS.lock().await;
    servers.remove(&server_id);
  });
}

fn spawn_keepalive(server_id: String, process: Arc<Mutex<LspProcess>>) {
  tokio::spawn(async move {
    loop {
      sleep(Duration::from_secs(5)).await;
      let exited = {
        let mut guard = process.lock().await;
        match guard.child.try_wait() {
          Ok(Some(_)) => true,
          Ok(None) => false,
          Err(_) => true,
        }
      };

      if exited {
        set_state(
          &server_id,
          false,
          Some("Language server crashed".to_string()),
          None,
          Some("crashed".to_string()),
        )
        .await;
        let servers = LSP_SERVERS.lock().await;
        if let Some(managed) = servers.get(&server_id) {
          let mut restart = managed.restart.lock().await;
          *restart = true;
        }
        break;
      }
    }
  });
}

async fn ensure_document_open(
  process: &Mutex<LspProcess>,
  workspace_root: &str,
  path: &str,
  content: Option<&str>,
) -> Result<String, String> {
  let absolute = resolve_workspace_path(workspace_root, path)?;
  let uri = path_to_uri(&absolute);

  let needs_open = {
    let guard = process.lock().await;
    !guard.open_documents.contains_key(&uri)
  };

  if !needs_open {
    return Ok(uri);
  }

  let document_content = if let Some(content) = content {
    content.to_string()
  } else {
    std::fs::read_to_string(&absolute).map_err(|error| error.to_string())?
  };
  let extension = absolute
    .extension()
    .and_then(|value| value.to_str())
    .unwrap_or_default();
  let language_id = language_id_for_extension(extension);

  let version = 1;

  send_notification(
    process,
    "textDocument/didOpen",
    serde_json::json!({
      "textDocument": {
        "uri": uri,
        "languageId": language_id,
        "version": version,
        "text": document_content,
      }
    }),
  )
  .await?;

  let mut guard = process.lock().await;
  guard.open_documents.insert(uri.clone(), version);

  Ok(uri)
}

async fn sync_document_change(
  process: &Mutex<LspProcess>,
  workspace_root: &str,
  path: &str,
) -> Result<String, String> {
  let absolute = resolve_workspace_path(workspace_root, path)?;
  let content = std::fs::read_to_string(&absolute).map_err(|error| error.to_string())?;
  sync_document_change_with_content(process, workspace_root, path, &content).await
}

async fn sync_document_change_with_content(
  process: &Mutex<LspProcess>,
  workspace_root: &str,
  path: &str,
  content: &str,
) -> Result<String, String> {
  let uri = ensure_document_open(process, workspace_root, path, Some(content)).await?;

  let version = {
    let mut guard = process.lock().await;
    let next_version = guard
      .open_documents
      .get(&uri)
      .copied()
      .unwrap_or(0)
      + 1;
    guard.open_documents.insert(uri.clone(), next_version);
    next_version
  };

  send_notification(
    process,
    "textDocument/didChange",
    serde_json::json!({
      "textDocument": {
        "uri": uri,
        "version": version,
      },
      "contentChanges": [{ "text": content }],
    }),
  )
  .await?;

  Ok(uri)
}

async fn close_document(process: &Mutex<LspProcess>, uri: &str) -> Result<(), String> {
  let should_close = {
    let guard = process.lock().await;
    guard.open_documents.contains_key(uri)
  };

  if !should_close {
    return Ok(());
  }

  send_notification(
    process,
    "textDocument/didClose",
    serde_json::json!({
      "textDocument": { "uri": uri }
    }),
  )
  .await?;

  let mut guard = process.lock().await;
  guard.open_documents.remove(uri);
  guard.diagnostics_by_uri.remove(uri);
  Ok(())
}

async fn start_server(
  server_id: String,
  entry: LspServerEntry,
  workspace_root: String,
  app: AppHandle,
) -> Result<Arc<Mutex<LspProcess>>, String> {
  let trusted = workspace_is_trusted(&app, Some(workspace_root.as_str()));
  let mut resolved = resolve_lsp_command(&app, &server_id, &entry, &workspace_root, trusted)?;
  inject_vue_tsdk_arg(&app, &server_id, &workspace_root, trusted, &mut resolved);

  let mut command = Command::new(&resolved.program);
  command
    .args(&resolved.args)
    .current_dir(&workspace_root)
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::null())
    .kill_on_drop(true);

  for (key, value) in &entry.env {
    command.env(key, value);
  }

  let mut child = command.spawn().map_err(|error| {
    format!(
      "Failed to start LSP '{server_id}' ({resolved_program}): {error}",
      resolved_program = resolved.program
    )
  })?;
  let stdin = child
    .stdin
    .take()
    .ok_or_else(|| "LSP stdin unavailable".to_string())?;

  let process = Arc::new(Mutex::new(LspProcess {
    child,
    stdin,
    workspace_root: workspace_root.clone(),
    open_documents: HashMap::new(),
    diagnostics_by_uri: HashMap::new(),
    pending: Mutex::new(HashMap::new()),
    next_id: Mutex::new(0),
  }));

  spawn_reader(process.clone(), server_id.clone(), app.clone());
  spawn_keepalive(server_id.clone(), process.clone());

  let root_uri = path_to_uri(&canonical_project_root(&workspace_root)?);
  let init_options =
    build_initialization_options(&app, &server_id, &entry.initialization, &workspace_root, trusted);

  json_rpc_request(
    &process,
    "initialize",
    serde_json::json!({
      "processId": std::process::id(),
      "rootPath": workspace_root,
      "rootUri": root_uri,
      "capabilities": {
        "textDocument": {
          "synchronization": {
            "dynamicRegistration": false,
            "didSave": false,
            "willSave": false,
            "willSaveWaitUntil": false
          },
          "publishDiagnostics": {},
          "diagnostic": {
            "dynamicRegistration": false,
            "relatedDocumentSupport": false
          },
          "hover": {
            "contentFormat": ["markdown", "plaintext"]
          },
          "completion": {
            "completionItem": {
              "snippetSupport": true,
              "documentationFormat": ["markdown", "plaintext"]
            }
          },
          "definition": { "linkSupport": true },
          "references": {},
          "documentSymbol": {
            "hierarchicalDocumentSymbolSupport": true
          }
        },
        "workspace": {
          "configuration": true,
          "workspaceFolders": true,
          "symbol": {}
        }
      },
      "initializationOptions": init_options,
      "trace": "off",
      "workspaceFolders": [{
        "uri": root_uri,
        "name": Path::new(&workspace_root)
          .file_name()
          .and_then(|name| name.to_str())
          .unwrap_or("workspace")
      }]
    }),
  )
  .await?;

  send_notification(&process, "initialized", serde_json::json!({})).await?;

  {
    let mut servers = LSP_SERVERS.lock().await;
    servers.insert(
      server_id.clone(),
      Arc::new(ManagedLspServer {
        process: process.clone(),
        restart: Mutex::new(false),
      }),
    );
  }

  set_state(
    &server_id,
    true,
    None,
    Some(resolved.source),
    Some("ready".to_string()),
  )
  .await;
  Ok(process)
}

async fn stop_server_internal(server_id: &str) -> Result<(), String> {
  let managed = {
    let mut servers = LSP_SERVERS.lock().await;
    servers.remove(server_id)
  };

  let Some(managed) = managed else {
    set_state(server_id, false, None, None, Some("stopped".to_string())).await;
    return Ok(());
  };

  let process = managed.process.clone();
  let uris = {
    let guard = process.lock().await;
    guard
      .open_documents
      .keys()
      .cloned()
      .collect::<Vec<_>>()
  };

  for uri in uris {
    let _ = close_document(&process, &uri).await;
  }

  let _ = json_rpc_request(&process, "shutdown", serde_json::Value::Null).await;
  let _ = send_notification(&process, "exit", serde_json::json!({})).await;

  {
    let mut guard = process.lock().await;
    let _ = guard.child.kill().await;
  }

  set_state(server_id, false, None, None, Some("stopped".to_string())).await;
  Ok(())
}

async fn ensure_running_server(
  app: &AppHandle,
  extension: &str,
  project_root: Option<String>,
) -> Result<LspServerStatus, String> {
  let servers = load_effective_servers(app).await?;

  let workspace_root = project_root
    .or_else(|| active_project_root(app))
    .or_else(|| Some(super::paths::get_default_workspace_root()))
    .ok_or_else(|| "No active workspace for LSP".to_string())?;

  let (server_id, entry) =
    find_server_for_extension(app, &servers, extension, Some(workspace_root.as_str()))
      .ok_or_else(|| format!("No LSP server configured for extension: {extension}"))?;

  if let Some(spec) = builtin_spec_by_id(&server_id) {
    if spec.requires_trust {
      if !workspace_is_trusted(app, Some(workspace_root.as_str())) {
        return Ok(LspServerStatus {
          id: server_id,
          running: false,
          error: Some("Workspace trust required for this language server".to_string()),
          source: Some("none".to_string()),
          install_state: Some("needs_trust".to_string()),
        });
      }
    }
  }

  set_state(
    &server_id,
    false,
    None,
    Some(install_source_label(app, &server_id)),
    Some("starting".to_string()),
  )
  .await;

  match ensure_server_installed(app, &server_id).await {
    Ok(_) => {}
    Err(error) => {
      set_state(
        &server_id,
        false,
        Some(error.clone()),
        Some(install_source_label(app, &server_id)),
        Some("error".to_string()),
      )
      .await;
      // Continue: PATH fallback may still work inside resolve_lsp_command
      let _ = error;
    }
  }

  // Warm portable node for npm-backed servers
  if builtin_spec_by_id(&server_id)
    .map(|s| s.npm.is_some())
    .unwrap_or(false)
  {
    let _ = ensure_portable_node(app).await;
  }

  if let Some(managed) = LSP_SERVERS.lock().await.get(&server_id).cloned() {
    let (should_restart, current_root) = {
      let restart = managed.restart.lock().await;
      let guard = managed.process.lock().await;
      (*restart, guard.workspace_root.clone())
    };

    if current_root != workspace_root {
      stop_server_internal(&server_id).await.ok();
    } else if !should_restart {
      let running = {
        let mut guard = managed.process.lock().await;
        guard.child.try_wait().ok().flatten().is_none()
      };

      if running {
        set_state(
          &server_id,
          true,
          None,
          Some(install_source_label(app, &server_id)),
          Some("ready".to_string()),
        )
        .await;
        return Ok(LspServerStatus {
          id: server_id.clone(),
          running: true,
          error: None,
          source: Some(install_source_label(app, &server_id)),
          install_state: Some("ready".to_string()),
        });
      }
    } else {
      stop_server_internal(&server_id).await.ok();
    }
  }

  match start_server(server_id.clone(), entry, workspace_root, app.clone()).await {
    Ok(_) => Ok(LspServerStatus {
      id: server_id.clone(),
      running: true,
      error: None,
      source: Some(install_source_label(app, &server_id)),
      install_state: Some("ready".to_string()),
    }),
    Err(error) => {
      set_state(
        &server_id,
        false,
        Some(error.clone()),
        Some(install_source_label(app, &server_id)),
        Some("error".to_string()),
      )
      .await;
      Ok(LspServerStatus {
        id: server_id,
        running: false,
        error: Some(error),
        source: Some("none".to_string()),
        install_state: Some("error".to_string()),
      })
    }
  }
}

#[tauri::command]
pub async fn lsp_status() -> Result<Vec<LspServerStatus>, String> {
  let states = LSP_STATES.lock().await;
  if states.is_empty() {
    return Ok(vec![]);
  }

  let mut statuses = states.values().cloned().collect::<Vec<_>>();
  statuses.sort_by(|left, right| left.id.cmp(&right.id));
  Ok(statuses)
}

fn normalize_lsp_method(method: &str) -> Result<&str, String> {
  match method {
    "goToDefinition" => Ok("textDocument/definition"),
    "hover" => Ok("textDocument/hover"),
    "findReferences" => Ok("textDocument/references"),
    "symbols" | "documentSymbol" => Ok("textDocument/documentSymbol"),
    "workspaceSymbol" | "workspace/symbol" => Ok("workspace/symbol"),
    "diagnostics" | "publishDiagnostics" => Ok("textDocument/diagnostic"),
    "workspace/executeCommand" | "executeCommand" => {
      Err("workspace/executeCommand is not allowed".to_string())
    }
    other if other.starts_with("textDocument/") || other.starts_with("workspace/") => {
      if other.contains("executeCommand") {
        return Err("executeCommand is not allowed".to_string());
      }
      Ok(other)
    }
    other => Err(format!(
      "Unsupported LSP method '{other}'. Use goToDefinition, findReferences, hover, symbols, workspaceSymbol, or diagnostics."
    )),
  }
}

fn lsp_method_is_notification(method: &str) -> bool {
  matches!(
    method,
    "initialized" | "exit" | "textDocument/didOpen" | "textDocument/didChange" | "textDocument/didClose"
  )
}

#[tauri::command]
pub async fn lsp_request(
  _app: AppHandle,
  server_id: String,
  method: String,
  params: serde_json::Value,
) -> Result<serde_json::Value, String> {
  let method = normalize_lsp_method(&method)?.to_string();

  let managed = {
    let servers = LSP_SERVERS.lock().await;
    servers.get(&server_id).cloned()
  };

  let Some(managed) = managed else {
    return Err("LSP not started".to_string());
  };

  let process = managed.process.clone();
  let workspace_root = {
    let guard = process.lock().await;
    guard.workspace_root.clone()
  };

  if method == "textDocument/didOpen" {
    let path = params
      .get("path")
      .and_then(|value| value.as_str())
      .ok_or_else(|| "path required for textDocument/didOpen".to_string())?;
    let content = params.get("content").and_then(|value| value.as_str());
    let uri = ensure_document_open(&process, &workspace_root, path, content).await?;
    if server_id == "vue" {
      mirror_vue_document_to_typescript(&_app, &workspace_root, path, content, "open").await;
    }
    return Ok(serde_json::json!({ "uri": uri }));
  }

  if method == "textDocument/didChange" {
    let path = params
      .get("path")
      .and_then(|value| value.as_str())
      .ok_or_else(|| "path required for textDocument/didChange".to_string())?;
    let uri = if let Some(content) = params.get("content").and_then(|value| value.as_str()) {
      let uri =
        sync_document_change_with_content(&process, &workspace_root, path, content).await?;
      if server_id == "vue" {
        mirror_vue_document_to_typescript(&_app, &workspace_root, path, Some(content), "change")
          .await;
      }
      uri
    } else {
      let uri = sync_document_change(&process, &workspace_root, path).await?;
      if server_id == "vue" {
        mirror_vue_document_to_typescript(&_app, &workspace_root, path, None, "change").await;
      }
      uri
    };
    return Ok(serde_json::json!({ "uri": uri }));
  }

  if method == "textDocument/didClose" {
    let path = params
      .get("path")
      .and_then(|value| value.as_str())
      .ok_or_else(|| "path required for textDocument/didClose".to_string())?;
    let absolute = resolve_workspace_path(&workspace_root, path)?;
    let uri = path_to_uri(&absolute);
    close_document(&process, &uri).await?;
    if server_id == "vue" {
      mirror_vue_document_to_typescript(&_app, &workspace_root, path, None, "close").await;
    }
    return Ok(serde_json::json!({ "uri": uri }));
  }

  let mut lsp_params = params;
  if let Some(path) = lsp_params
    .get("path")
    .and_then(|value| value.as_str())
    .map(str::to_string)
  {
    let content = lsp_params.get("content").and_then(|value| value.as_str());
    let uri = ensure_document_open(&process, &workspace_root, &path, content).await?;
    if let Some(object) = lsp_params.as_object_mut() {
      object.remove("path");
      if method.starts_with("textDocument/") && !object.contains_key("textDocument") {
        object.insert("textDocument".to_string(), serde_json::json!({ "uri": uri }));
      }
    }
  }

  if lsp_method_is_notification(&method) {
    send_notification(&process, &method, lsp_params).await?;
    return Ok(serde_json::Value::Null);
  }

  if method == "textDocument/diagnostic" {
    let uri = lsp_params
      .get("textDocument")
      .and_then(|text_document| text_document.get("uri"))
      .and_then(|value| value.as_str())
      .map(str::to_string);

    if let Some(uri) = uri.as_ref() {
      for _ in 0..12 {
        {
          let guard = process.lock().await;
          if let Some(items) = guard.diagnostics_by_uri.get(uri) {
            return Ok(serde_json::json!({
              "kind": "full",
              "items": items,
            }));
          }
        }
        sleep(Duration::from_millis(50)).await;
      }
    }

    match json_rpc_request(&process, &method, lsp_params).await {
      Ok(result) => return Ok(result),
      Err(pull_error) => {
        if let Some(uri) = uri.as_ref() {
          let guard = process.lock().await;
          if let Some(items) = guard.diagnostics_by_uri.get(uri) {
            return Ok(serde_json::json!({
              "kind": "full",
              "items": items,
            }));
          }
        }
        let lower = pull_error.to_ascii_lowercase();
        if lower.contains("unhandled method")
          || lower.contains("method not found")
          || lower.contains("code -32601")
        {
          return Ok(serde_json::json!({
            "kind": "full",
            "items": [],
          }));
        }
        return Err(pull_error);
      }
    }
  }

  json_rpc_request(&process, &method, lsp_params).await
}

#[tauri::command]
pub async fn lsp_ensure_server(
  app: AppHandle,
  extension: String,
  project_root: Option<String>,
) -> Result<LspServerStatus, String> {
  ensure_running_server(&app, &extension, project_root).await
}

#[tauri::command]
pub async fn lsp_stop_server(server_id: String) -> Result<(), String> {
  stop_server_internal(&server_id).await
}

#[tauri::command]
pub async fn lsp_catalog(app: AppHandle) -> Result<Vec<LspCatalogEntry>, String> {
  let effective = load_effective_servers(&app).await.unwrap_or_default();
  let states = LSP_STATES.lock().await;
  let mut entries: Vec<LspCatalogEntry> = Vec::new();
  let mut seen = std::collections::HashSet::new();

  for spec in builtin_specs() {
    seen.insert(spec.id.to_string());
    let state = states.get(spec.id);
    let source = install_source_label(&app, spec.id);
    let installed = source != "none";
    let installable = is_managed_install_kind(spec.install);
    let disabled = !effective.contains_key(spec.id);
    entries.push(LspCatalogEntry {
      id: spec.id.to_string(),
      label: server_display_label(spec.id),
      extensions: spec.extensions.iter().map(|ext| (*ext).to_string()).collect(),
      install_kind: install_kind_label(spec.install).to_string(),
      requires_trust: spec.requires_trust,
      installable,
      installed,
      running: state.map(|s| s.running).unwrap_or(false),
      disabled,
      error: state.and_then(|s| s.error.clone()),
      source: Some(source),
      install_state: state.and_then(|s| s.install_state.clone()).or_else(|| {
        if installed {
          Some("ready".to_string())
        } else if installable {
          Some("missing".to_string())
        } else {
          Some("toolchain".to_string())
        }
      }),
    });
  }

  for (id, entry) in &effective {
    if seen.contains(id) {
      continue;
    }
    let state = states.get(id);
    let source = if server_binary_available(&app, id, entry) {
      "custom".to_string()
    } else {
      "none".to_string()
    };
    entries.push(LspCatalogEntry {
      id: id.clone(),
      label: server_display_label(id),
      extensions: entry.extensions.clone(),
      install_kind: "custom".to_string(),
      requires_trust: false,
      installable: false,
      installed: source != "none",
      running: state.map(|s| s.running).unwrap_or(false),
      disabled: false,
      error: state.and_then(|s| s.error.clone()),
      source: Some(source),
      install_state: state.and_then(|s| s.install_state.clone()),
    });
  }

  entries.sort_by(|left, right| left.label.cmp(&right.label));
  Ok(entries)
}

#[tauri::command]
pub async fn lsp_uninstall_server(app: AppHandle, server_id: String) -> Result<(), String> {
  stop_server_internal(&server_id).await?;
  remove_managed_install(&app, &server_id)?;
  set_state(
    &server_id,
    false,
    None,
    Some("none".to_string()),
    Some("missing".to_string()),
  )
  .await;
  Ok(())
}

fn opt_in_server_entry(spec: &BuiltinLspSpec) -> serde_json::Value {
  serde_json::json!({
    "command": spec.command,
    "extensions": spec.extensions,
  })
}

fn is_default_enabled_builtin(server_id: &str) -> bool {
  builtin_server_map().contains_key(server_id)
}

/// Apply enable/disable to an lsp.json object. Opt-in servers (Tier D: biome, eslint, oxlint)
/// are absent from the default builtin map, so enabling them writes a full command entry.
fn apply_server_disabled_flag(
  object: &mut serde_json::Map<String, serde_json::Value>,
  server_id: &str,
  disabled: bool,
) {
  if disabled {
    let entry = object
      .entry(server_id.to_string())
      .or_insert_with(|| serde_json::json!({}));
    if let Some(entry_object) = entry.as_object_mut() {
      entry_object.insert("disabled".to_string(), serde_json::Value::Bool(true));
    } else {
      *entry = serde_json::json!({ "disabled": true });
    }
    return;
  }

  // Enabling
  let opt_in_spec = builtin_spec_by_id(server_id).filter(|spec| !is_default_enabled_builtin(spec.id));

  if let Some(spec) = opt_in_spec {
    object.insert(server_id.to_string(), opt_in_server_entry(spec));
    return;
  }

  if let Some(entry) = object.get_mut(server_id) {
    if let Some(entry_object) = entry.as_object_mut() {
      entry_object.remove("disabled");
      if entry_object.is_empty() {
        object.remove(server_id);
      }
    }
  }
}

#[tauri::command]
pub async fn lsp_set_server_disabled(
  app: AppHandle,
  server_id: String,
  disabled: bool,
) -> Result<(), String> {
  let mut config = load_lsp_config(&app)?;
  if config.is_null() || config.is_boolean() {
    config = serde_json::json!({});
  }
  let object = config
    .as_object_mut()
    .ok_or_else(|| "lsp.json must be an object to toggle servers".to_string())?;

  apply_server_disabled_flag(object, &server_id, disabled);

  super::config::write_lsp_config_internal(&app, config)?;

  if disabled {
    stop_server_internal(&server_id).await.ok();
  }

  Ok(())
}

#[cfg(test)]
mod tests {
  use super::{
    apply_server_disabled_flag, resolve_lsp_servers, server_display_label, tsserver_request_body,
    unwrap_tsserver_request_tuple,
  };

  #[test]
  fn unwraps_vscode_jsonrpc_wrapped_tsserver_tuple() {
    let params = serde_json::json!([[1, "_vue:projectInfo", { "file": "/tmp/App.vue" }]]);
    let items = unwrap_tsserver_request_tuple(&params).unwrap();
    assert_eq!(items[0], serde_json::json!(1));
    assert_eq!(items[1], serde_json::json!("_vue:projectInfo"));
  }

  #[test]
  fn accepts_unwrapped_tsserver_tuple() {
    let params = serde_json::json!([2, "_vue:quickinfo", { "file": "/tmp/App.vue" }]);
    let items = unwrap_tsserver_request_tuple(&params).unwrap();
    assert_eq!(items[0], serde_json::json!(2));
    assert_eq!(items[1], serde_json::json!("_vue:quickinfo"));
  }

  #[test]
  fn tsserver_request_body_prefers_nested_body() {
    let value = serde_json::json!({
      "type": "response",
      "body": { "displayString": "string" }
    });
    assert_eq!(
      tsserver_request_body(value),
      serde_json::json!({ "displayString": "string" })
    );
  }

  #[test]
  fn tsserver_request_body_falls_back_to_whole_value() {
    let value = serde_json::json!({ "ok": true });
    assert_eq!(tsserver_request_body(value), serde_json::json!({ "ok": true }));
  }

  #[test]
  fn resolve_true_keeps_builtins() {
    let servers = resolve_lsp_servers(&serde_json::json!(true), None).unwrap();
    assert!(servers.contains_key("typescript"));
    assert!(servers.contains_key("vue"));
    assert!(
      !servers.contains_key("biome"),
      "tier D servers stay opt-in by default"
    );
  }

  #[test]
  fn resolve_false_disables_all() {
    assert!(resolve_lsp_servers(&serde_json::json!(false), None).is_none());
  }

  #[test]
  fn resolve_disabled_flag_removes_server() {
    let raw = serde_json::json!({
      "typescript": { "disabled": true }
    });
    let servers = resolve_lsp_servers(&raw, None).unwrap();
    assert!(!servers.contains_key("typescript"));
    assert!(servers.contains_key("vue"));
  }

  #[test]
  fn enabling_biome_writes_opt_in_entry_and_resolves() {
    let mut config = serde_json::json!({});
    let object = config.as_object_mut().unwrap();
    apply_server_disabled_flag(object, "biome", false);

    let biome = object.get("biome").unwrap().as_object().unwrap();
    assert_eq!(biome.get("disabled"), None);
    assert!(biome.get("command").unwrap().as_array().unwrap().len() >= 1);

    let servers = resolve_lsp_servers(&config, None).unwrap();
    assert!(servers.contains_key("biome"));
    assert!(servers.contains_key("typescript"));
  }

  #[test]
  fn enabling_biome_after_disabled_restores_opt_in_entry() {
    let mut config = serde_json::json!({
      "biome": { "disabled": true }
    });
    let object = config.as_object_mut().unwrap();
    apply_server_disabled_flag(object, "biome", false);

    let biome = object.get("biome").unwrap().as_object().unwrap();
    assert_eq!(biome.get("disabled"), None);
    assert!(biome.contains_key("command"));

    let servers = resolve_lsp_servers(&config, None).unwrap();
    assert!(servers.contains_key("biome"));
  }

  #[test]
  fn disabling_biome_marks_disabled_and_drops_from_effective() {
    let mut config = serde_json::json!({});
    let object = config.as_object_mut().unwrap();
    apply_server_disabled_flag(object, "biome", false);
    apply_server_disabled_flag(object, "biome", true);

    assert_eq!(
      object.get("biome").unwrap().get("disabled").and_then(|v| v.as_bool()),
      Some(true)
    );

    let servers = resolve_lsp_servers(&config, None).unwrap();
    assert!(!servers.contains_key("biome"));
  }

  #[test]
  fn enabling_default_builtin_clears_disabled_override() {
    let mut config = serde_json::json!({
      "typescript": { "disabled": true }
    });
    let object = config.as_object_mut().unwrap();
    apply_server_disabled_flag(object, "typescript", false);
    assert!(!object.contains_key("typescript"));

    let servers = resolve_lsp_servers(&config, None).unwrap();
    assert!(servers.contains_key("typescript"));
  }

  #[test]
  fn display_label_is_human_readable() {
    assert_eq!(server_display_label("typescript"), "TypeScript / JavaScript");
    assert_eq!(server_display_label("gopls"), "Go");
    assert_eq!(server_display_label("custom-lsp"), "Custom Lsp");
  }
}
