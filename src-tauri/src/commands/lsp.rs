use std::collections::HashMap;
use std::path::Path;
use std::process::Stdio;
use std::sync::Arc;

use serde::Serialize;
use tauri::AppHandle;
use tokio::io::{AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::sync::{oneshot, Mutex};
use tokio::time::{sleep, Duration};

use super::config::{lsp_enabled_in_settings, read_lsp_scope_configs};
use super::fs::{canonical_project_root, resolve_workspace_path};
use super::registry::{get_active_project, registry_list_projects};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LspServerStatus {
  pub id: String,
  pub running: bool,
  pub error: Option<String>,
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

async fn set_state(id: &str, running: bool, error: Option<String>) {
  let mut states = LSP_STATES.lock().await;
  states.insert(
    id.to_string(),
    LspServerStatus {
      id: id.to_string(),
      running,
      error,
    },
  );
}

fn builtin_lsp_servers() -> HashMap<String, LspServerEntry> {
  HashMap::from([
    (
      "typescript".to_string(),
      LspServerEntry {
        command: vec!["typescript-language-server".to_string(), "--stdio".to_string()],
        extensions: vec![
          ".ts".to_string(),
          ".tsx".to_string(),
          ".js".to_string(),
          ".jsx".to_string(),
          ".mjs".to_string(),
          ".cjs".to_string(),
          ".mts".to_string(),
          ".cts".to_string(),
        ],
        env: HashMap::new(),
        initialization: serde_json::json!({}),
      },
    ),
    (
      "rust".to_string(),
      LspServerEntry {
        command: vec!["rust-analyzer".to_string()],
        extensions: vec![".rs".to_string()],
        env: HashMap::new(),
        initialization: serde_json::json!({}),
      },
    ),
    (
      "gopls".to_string(),
      LspServerEntry {
        command: vec!["gopls".to_string()],
        extensions: vec![".go".to_string()],
        env: HashMap::new(),
        initialization: serde_json::json!({}),
      },
    ),
    (
      "pylsp".to_string(),
      LspServerEntry {
        command: vec!["pylsp".to_string()],
        extensions: vec![".py".to_string(), ".pyi".to_string()],
        env: HashMap::new(),
        initialization: serde_json::json!({}),
      },
    ),
  ])
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

fn merge_lsp_servers(
  personal: &serde_json::Value,
  project: &serde_json::Value,
) -> Option<HashMap<String, LspServerEntry>> {
  let personal_resolved = resolve_lsp_servers(personal, None)?;
  if project.is_null() || project.as_object().is_some_and(|object| object.is_empty()) {
    return Some(personal_resolved);
  }

  resolve_lsp_servers(project, Some(personal_resolved))
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

fn find_server_for_extension(
  servers: &HashMap<String, LspServerEntry>,
  extension: &str,
) -> Option<(String, LspServerEntry)> {
  servers
    .iter()
    .find(|(_, entry)| extension_matches(entry, extension))
    .map(|(id, entry)| (id.clone(), entry.clone()))
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
  let project_root = active_project_root(app);
  if !lsp_enabled_in_settings(app, project_root.as_deref()) {
    return Err("LSP disabled".to_string());
  }

  let (personal, project) = read_lsp_scope_configs(app, project_root)?;
  let personal_effective = if personal.is_null() || personal.as_object().is_some_and(|o| o.is_empty()) {
    serde_json::json!(true)
  } else {
    personal
  };

  merge_lsp_servers(&personal_effective, &project).ok_or_else(|| "LSP disabled".to_string())
}

fn path_to_uri(path: &Path) -> String {
  let mut normalized = path.to_string_lossy().replace('\\', "/");
  if !normalized.starts_with('/') {
    normalized = format!("/{normalized}");
  }
  format!("file://{normalized}")
}

fn language_id_for_extension(extension: &str) -> String {
  match extension.trim_start_matches('.') {
    "ts" | "tsx" => "typescript".to_string(),
    "js" | "jsx" | "mjs" | "cjs" | "mts" | "cts" => "javascript".to_string(),
    "rs" => "rust".to_string(),
    "go" => "go".to_string(),
    "py" | "pyi" => "python".to_string(),
    "vue" => "vue".to_string(),
    "json" => "json".to_string(),
    "md" => "markdown".to_string(),
    other => other.to_string(),
  }
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

async fn json_rpc_request(
  process: &Mutex<LspProcess>,
  method: &str,
  params: serde_json::Value,
) -> Result<serde_json::Value, String> {
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

  let response = rx
    .await
    .map_err(|_| "LSP request cancelled".to_string())?;

  if let Some(error) = response.get("error") {
    let message = error
      .get("message")
      .and_then(|value| value.as_str())
      .unwrap_or("LSP request failed")
      .to_string();
    return Err(message);
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

fn spawn_reader(process: Arc<Mutex<LspProcess>>, server_id: String) {
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
        let result = match method {
          "window/workDoneProgress/create" => serde_json::json!(null),
          "client/registerCapability" => serde_json::json!(null),
          "workspace/configuration" => serde_json::json!([]),
          _ => serde_json::json!(null),
        };
        let _ = respond_to_server_request(&process, &id, result).await;
        continue;
      }

      if let Some(id) = message.get("id").and_then(|value| value.as_u64()) {
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

    set_state(&server_id, false, Some("Language server exited".to_string())).await;
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
        set_state(&server_id, false, Some("Language server crashed".to_string())).await;
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

  let content = std::fs::read_to_string(&absolute).map_err(|error| error.to_string())?;
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
        "text": content,
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
  let uri = ensure_document_open(process, workspace_root, path).await?;

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
  Ok(())
}

async fn start_server(
  server_id: String,
  entry: LspServerEntry,
  workspace_root: String,
) -> Result<Arc<Mutex<LspProcess>>, String> {
  let program = entry
    .command
    .first()
    .cloned()
    .ok_or_else(|| "LSP command missing".to_string())?;
  let args = entry.command.iter().skip(1).cloned().collect::<Vec<_>>();

  let mut command = Command::new(program);
  command
    .args(args)
    .current_dir(&workspace_root)
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::null())
    .kill_on_drop(true);

  for (key, value) in &entry.env {
    command.env(key, value);
  }

  let mut child = command.spawn().map_err(|error| error.to_string())?;
  let stdin = child
    .stdin
    .take()
    .ok_or_else(|| "LSP stdin unavailable".to_string())?;

  let process = Arc::new(Mutex::new(LspProcess {
    child,
    stdin,
    workspace_root: workspace_root.clone(),
    open_documents: HashMap::new(),
    pending: Mutex::new(HashMap::new()),
    next_id: Mutex::new(0),
  }));

  spawn_reader(process.clone(), server_id.clone());
  spawn_keepalive(server_id.clone(), process.clone());

  let root_uri = path_to_uri(&canonical_project_root(&workspace_root)?);
  let init_options = if entry.initialization.is_null() {
    serde_json::json!({})
  } else {
    entry.initialization.clone()
  };

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
          }
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

  set_state(&server_id, true, None).await;
  Ok(process)
}

async fn stop_server_internal(server_id: &str) -> Result<(), String> {
  let managed = {
    let mut servers = LSP_SERVERS.lock().await;
    servers.remove(server_id)
  };

  let Some(managed) = managed else {
    set_state(server_id, false, None).await;
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

  set_state(server_id, false, None).await;
  Ok(())
}

async fn ensure_running_server(
  app: &AppHandle,
  extension: &str,
) -> Result<LspServerStatus, String> {
  let servers = load_effective_servers(app).await?;
  let (server_id, entry) = find_server_for_extension(&servers, extension)
    .ok_or_else(|| format!("No LSP server configured for extension: {extension}"))?;

  if let Some(managed) = LSP_SERVERS.lock().await.get(&server_id).cloned() {
    let should_restart = {
      let restart = managed.restart.lock().await;
      *restart
    };

    if !should_restart {
      let running = {
        let mut guard = managed.process.lock().await;
        guard.child.try_wait().ok().flatten().is_none()
      };

      if running {
        return Ok(LspServerStatus {
          id: server_id,
          running: true,
          error: None,
        });
      }
    }

    stop_server_internal(&server_id).await.ok();
  }

  let workspace_root = active_project_root(app)
    .or_else(|| Some(super::paths::get_default_workspace_root()))
    .ok_or_else(|| "No active workspace for LSP".to_string())?;

  start_server(server_id.clone(), entry, workspace_root).await?;

  Ok(LspServerStatus {
    id: server_id,
    running: true,
    error: None,
  })
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

fn normalize_lsp_method(method: &str) -> &str {
  match method {
    "goToDefinition" => "textDocument/definition",
    "hover" => "textDocument/hover",
    "findReferences" => "textDocument/references",
    "symbols" | "documentSymbol" => "textDocument/documentSymbol",
    "diagnostics" | "publishDiagnostics" => "textDocument/diagnostic",
    other => other,
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
  let method = normalize_lsp_method(&method).to_string();

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
    let uri = ensure_document_open(&process, &workspace_root, path).await?;
    return Ok(serde_json::json!({ "uri": uri }));
  }

  if method == "textDocument/didChange" {
    let path = params
      .get("path")
      .and_then(|value| value.as_str())
      .ok_or_else(|| "path required for textDocument/didChange".to_string())?;
    let uri = if let Some(content) = params.get("content").and_then(|value| value.as_str()) {
      sync_document_change_with_content(&process, &workspace_root, path, content).await?
    } else {
      sync_document_change(&process, &workspace_root, path).await?
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
    return Ok(serde_json::json!({ "uri": uri }));
  }

  let mut lsp_params = params;
  if let Some(path) = lsp_params
    .get("path")
    .and_then(|value| value.as_str())
    .map(str::to_string)
  {
    let uri = ensure_document_open(&process, &workspace_root, &path).await?;
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

  json_rpc_request(&process, &method, lsp_params).await
}

#[tauri::command]
pub async fn lsp_ensure_server(app: AppHandle, extension: String) -> Result<LspServerStatus, String> {
  ensure_running_server(&app, &extension).await
}

#[tauri::command]
pub async fn lsp_stop_server(server_id: String) -> Result<(), String> {
  stop_server_internal(&server_id).await
}
