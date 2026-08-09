use std::collections::HashMap;
use std::path::Path;
use std::process::Stdio;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::{oneshot, Mutex};

const MCP_REQUEST_TIMEOUT: Duration = Duration::from_secs(45);

/// Basenames allowed for MCP stdio servers (resolved via PATH). Absolute paths are rejected.
const ALLOWED_MCP_COMMANDS: &[&str] = &[
  "npx", "npm", "node", "pnpm", "yarn", "bun", "deno", "uvx", "uv", "python", "python3", "pipx",
  "codegraph",
];

fn validate_mcp_spawn(command: &str, args: &[String]) -> Result<(), String> {
  let trimmed = command.trim();
  if trimmed.is_empty() {
    return Err("MCP command is required".to_string());
  }
  if trimmed.contains('/') || trimmed.contains('\\') || Path::new(trimmed).components().count() != 1
  {
    return Err(
      "MCP command must be a PATH basename (for example npx or uvx), not a filesystem path"
        .to_string(),
    );
  }
  let lower = trimmed.to_ascii_lowercase();
  if !ALLOWED_MCP_COMMANDS
    .iter()
    .any(|allowed| *allowed == lower)
  {
    return Err(format!(
      "MCP command '{trimmed}' is not allowed. Use one of: {}",
      ALLOWED_MCP_COMMANDS.join(", ")
    ));
  }
  for arg in args {
    if arg.contains('\0') {
      return Err("MCP args must not contain NUL bytes".to_string());
    }
  }
  Ok(())
}

fn is_dangerous_mcp_env_key(key: &str) -> bool {
  let upper = key.trim().to_ascii_uppercase();
  if upper.is_empty() {
    return true;
  }
  if upper.starts_with("DYLD_") || upper.starts_with("LD_") {
    return true;
  }
  matches!(
    upper.as_str(),
    "PATH"
      | "PATHEXT"
      | "LD_PRELOAD"
      | "LD_LIBRARY_PATH"
      | "LD_AUDIT"
      | "DYLD_INSERT_LIBRARIES"
      | "DYLD_LIBRARY_PATH"
      | "DYLD_FRAMEWORK_PATH"
      | "DYLD_FALLBACK_LIBRARY_PATH"
      | "DYLD_FORCE_FLAT_NAMESPACE"
      | "OPENSSL_CONF"
      | "PYTHONPATH"
      | "PYTHONHOME"
      | "NODE_OPTIONS"
      | "NODE_PATH"
      | "BASH_ENV"
      | "ENV"
      | "SHELLOPTS"
      | "IFS"
      | "CDPATH"
      | "PROMPT_COMMAND"
      | "PERL5LIB"
      | "PERL5OPT"
      | "RUBYOPT"
      | "RUBYLIB"
  )
}

fn validate_mcp_env(env: &HashMap<String, String>) -> Result<(), String> {
  for (key, value) in env {
    if is_dangerous_mcp_env_key(key) {
      return Err(format!("MCP env key '{key}' is not allowed"));
    }
    if key.contains('\0') || value.contains('\0') {
      return Err("MCP env must not contain NUL bytes".to_string());
    }
  }
  Ok(())
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpToolInfo {
  pub name: String,
  pub description: Option<String>,
  pub input_schema: Option<serde_json::Value>,
  pub meta: Option<serde_json::Value>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpIcon {
  pub src: String,
  pub mime_type: Option<String>,
  pub sizes: Option<Vec<String>>,
  pub theme: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServerState {
  pub server_id: String,
  pub status: String,
  pub error: Option<String>,
  pub tools: Vec<McpToolInfo>,
  pub icons: Option<Vec<McpIcon>>,
}

struct McpProcess {
  child: tokio::process::Child,
  pending: Mutex<HashMap<u64, oneshot::Sender<serde_json::Value>>>,
  next_id: Mutex<u64>,
}

lazy_static::lazy_static! {
  static ref MCP_PROCESSES: Mutex<HashMap<String, std::sync::Arc<Mutex<McpProcess>>>> =
    Mutex::new(HashMap::new());
  static ref MCP_STATES: Mutex<HashMap<String, McpServerState>> = Mutex::new(HashMap::new());
}

fn parse_mcp_icons(value: Option<&serde_json::Value>) -> Option<Vec<McpIcon>> {
  let icons = value?.as_array()?;
  let parsed: Vec<McpIcon> = icons
    .iter()
    .filter_map(|icon| {
      let src = icon.get("src")?.as_str()?.to_string();
      if src.is_empty() {
        return None;
      }
      Some(McpIcon {
        src,
        mime_type: icon
          .get("mimeType")
          .and_then(|v| v.as_str())
          .map(|s| s.to_string()),
        sizes: icon.get("sizes").and_then(|v| {
          v.as_array().map(|arr| {
            arr
              .iter()
              .filter_map(|item| item.as_str().map(|s| s.to_string()))
              .collect::<Vec<_>>()
          })
        }),
        theme: icon
          .get("theme")
          .and_then(|v| v.as_str())
          .map(|s| s.to_string()),
      })
    })
    .collect();
  if parsed.is_empty() {
    None
  } else {
    Some(parsed)
  }
}

async fn set_state(
  server_id: &str,
  status: &str,
  error: Option<String>,
  tools: Vec<McpToolInfo>,
  icons: Option<Vec<McpIcon>>,
) {
  let mut states = MCP_STATES.lock().await;
  let previous_icons = states.get(server_id).and_then(|state| state.icons.clone());
  states.insert(
    server_id.to_string(),
    McpServerState {
      server_id: server_id.to_string(),
      status: status.to_string(),
      error,
      tools,
      icons: icons.or(previous_icons),
    },
  );
}

async fn json_rpc(
  process: &Mutex<McpProcess>,
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

  let request = serde_json::json!({
    "jsonrpc": "2.0",
    "id": id,
    "method": method,
    "params": params,
  });

  let line = format!("{}\n", request);
  {
    let mut guard = process.lock().await;
    if let Some(stdin) = guard.child.stdin.as_mut() {
      stdin
        .write_all(line.as_bytes())
        .await
        .map_err(|e| e.to_string())?;
      stdin.flush().await.map_err(|e| e.to_string())?;
    } else {
      return Err("MCP process stdin unavailable".to_string());
    }
  }

  match tokio::time::timeout(MCP_REQUEST_TIMEOUT, rx).await {
    Ok(Ok(value)) => Ok(value),
    Ok(Err(_)) => Err("MCP request cancelled".to_string()),
    Err(_) => {
      let guard = process.lock().await;
      guard.pending.lock().await.remove(&id);
      Err(format!(
        "MCP request timed out after {}s ({method})",
        MCP_REQUEST_TIMEOUT.as_secs()
      ))
    }
  }
}

async fn json_rpc_notify(
  process: &Mutex<McpProcess>,
  method: &str,
  params: serde_json::Value,
) -> Result<(), String> {
  let request = serde_json::json!({
    "jsonrpc": "2.0",
    "method": method,
    "params": params,
  });
  let line = format!("{}\n", request);
  let mut guard = process.lock().await;
  if let Some(stdin) = guard.child.stdin.as_mut() {
    stdin
      .write_all(line.as_bytes())
      .await
      .map_err(|e| e.to_string())?;
    stdin.flush().await.map_err(|e| e.to_string())?;
    Ok(())
  } else {
    Err("MCP process stdin unavailable".to_string())
  }
}

fn response_id_as_u64(value: &serde_json::Value) -> Option<u64> {
  let id = value.get("id")?;
  if let Some(n) = id.as_u64() {
    return Some(n);
  }
  if let Some(n) = id.as_i64() {
    return u64::try_from(n).ok();
  }
  if let Some(s) = id.as_str() {
    return s.parse::<u64>().ok();
  }
  None
}

fn spawn_reader(process: std::sync::Arc<Mutex<McpProcess>>, server_id: String) {
  tokio::spawn(async move {
    let stdout = {
      let mut guard = process.lock().await;
      guard.child.stdout.take()
    };

    let Some(stdout) = stdout else {
      return;
    };

    let reader = BufReader::new(stdout);
    let mut lines = reader.lines();
    while let Ok(Some(line)) = lines.next_line().await {
      let Ok(value) = serde_json::from_str::<serde_json::Value>(&line) else {
        continue;
      };
      if let Some(id) = response_id_as_u64(&value) {
        let sender = {
          let guard = process.lock().await;
          let mut pending = guard.pending.lock().await;
          pending.remove(&id)
        };
        if let Some(sender) = sender {
          let _ = sender.send(value);
        }
      }
    }
    set_state(&server_id, "stopped", None, vec![], None).await;
    let mut processes = MCP_PROCESSES.lock().await;
    processes.remove(&server_id);
  });
}

#[tauri::command]
pub async fn mcp_start(
  server_id: String,
  command: String,
  args: Vec<String>,
  env: Option<HashMap<String, String>>,
) -> Result<McpServerState, String> {
  validate_mcp_spawn(&command, &args)?;
  let env_overlay = env.unwrap_or_default();
  validate_mcp_env(&env_overlay)?;
  mcp_stop(server_id.clone()).await.ok();

  let codegraph_path = if server_id == "codegraph" {
    extract_codegraph_project_path(&args)
  } else {
    None
  };
  if let Some(project_path) = codegraph_path.as_deref() {
    kill_orphaned_codegraph(project_path).await;
  }

  set_state(&server_id, "starting", None, vec![], None).await;

  let mut command_builder = Command::new(&command);
  command_builder
    .args(&args)
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .kill_on_drop(true);
  #[cfg(unix)]
  {
    command_builder.process_group(0);
  }
  for (key, value) in &env_overlay {
    command_builder.env(key, value);
  }

  let mut child = command_builder.spawn().map_err(|e| {
    let message = format!("Failed to spawn MCP command '{command}': {e}");
    message
  })?;

  // Drain stderr so the child cannot block on a full pipe; keep a short tail for errors.
  let stderr = child.stderr.take();
  let stderr_tail = std::sync::Arc::new(Mutex::new(String::new()));
  if let Some(stderr) = stderr {
    let stderr_tail = stderr_tail.clone();
    tokio::spawn(async move {
      let mut lines = BufReader::new(stderr).lines();
      while let Ok(Some(line)) = lines.next_line().await {
        let mut guard = stderr_tail.lock().await;
        if guard.len() < 4_000 {
          if !guard.is_empty() {
            guard.push('\n');
          }
          guard.push_str(&line);
        }
      }
    });
  }

  let process = std::sync::Arc::new(Mutex::new(McpProcess {
    child,
    pending: Mutex::new(HashMap::new()),
    next_id: Mutex::new(0),
  }));

  spawn_reader(process.clone(), server_id.clone());

  {
    let mut processes = MCP_PROCESSES.lock().await;
    processes.insert(server_id.clone(), process.clone());
  }

  let fail = |message: String| async {
    let stderr_text = stderr_tail.lock().await.clone();
    let full = if stderr_text.trim().is_empty() {
      message
    } else {
      format!("{message}\n{stderr_text}")
    };
    let _ = mcp_stop(server_id.clone()).await;
    if let Some(project_path) = codegraph_path.as_deref() {
      kill_orphaned_codegraph(project_path).await;
    }
    set_state(&server_id, "error", Some(full.clone()), vec![], None).await;
    Err(full)
  };

  let init = match json_rpc(
    &process,
    "initialize",
    serde_json::json!({
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": { "name": "pyrola", "version": "0.1.0" }
    }),
  )
  .await
  {
    Ok(value) => value,
    Err(message) => return fail(message).await,
  };

  if init.get("error").is_some() {
    let message = init
      .get("error")
      .and_then(|e| e.get("message"))
      .and_then(|m| m.as_str())
      .unwrap_or("initialize failed")
      .to_string();
    return fail(message).await;
  }

  if let Err(message) = json_rpc_notify(
    &process,
    "notifications/initialized",
    serde_json::json!({}),
  )
  .await
  {
    return fail(message).await;
  }

  let icons = parse_mcp_icons(
    init
      .get("result")
      .and_then(|result| result.get("serverInfo"))
      .and_then(|info| info.get("icons")),
  );
  let tools = match list_tools_internal(&process).await {
    Ok(tools) => tools,
    Err(message) => return fail(message).await,
  };
  set_state(
    &server_id,
    "connected",
    None,
    tools.clone(),
    icons.clone(),
  )
  .await;

  Ok(McpServerState {
    server_id,
    status: "connected".to_string(),
    error: None,
    tools,
    icons,
  })
}

async fn list_tools_internal(process: &Mutex<McpProcess>) -> Result<Vec<McpToolInfo>, String> {
  let response = json_rpc(process, "tools/list", serde_json::json!({})).await?;
  let tools = response
    .get("result")
    .and_then(|r| r.get("tools"))
    .and_then(|t| t.as_array())
    .cloned()
    .unwrap_or_default();

  Ok(
    tools
      .into_iter()
      .filter_map(|tool| {
        Some(McpToolInfo {
          name: tool.get("name")?.as_str()?.to_string(),
          description: tool
            .get("description")
            .and_then(|d| d.as_str())
            .map(|s| s.to_string()),
          input_schema: tool.get("inputSchema").cloned(),
          meta: tool.get("_meta").cloned(),
        })
      })
      .collect(),
  )
}

fn extract_codegraph_project_path(args: &[String]) -> Option<String> {
  let mut saw_path_flag = false;
  for arg in args {
    if saw_path_flag {
      let trimmed = arg.trim();
      if !trimmed.is_empty() {
        return Some(trimmed.to_string());
      }
      return None;
    }
    if arg == "--path" {
      saw_path_flag = true;
    }
  }
  None
}

/// Best-effort cleanup of orphaned CodeGraph MCP trees left behind when `npx`
/// reparents children out of the process group we track.
#[cfg(unix)]
async fn kill_orphaned_codegraph(project_path: &str) {
  let path = project_path.trim();
  if path.is_empty() {
    return;
  }
  let patterns = [
    format!("codegraph.js serve --mcp --path {path}"),
    format!("codegraph serve --mcp --path {path}"),
    format!("@colbymchenry/codegraph serve --mcp --path {path}"),
  ];
  for pattern in patterns {
    let _ = Command::new("pkill")
      .args(["-f", &pattern])
      .stdout(Stdio::null())
      .stderr(Stdio::null())
      .status()
      .await;
  }
  // Stale daemon socket blocks a clean restart after orphan kill storms.
  let daemon_dir = Path::new(path).join(".codegraph");
  let _ = tokio::fs::remove_file(daemon_dir.join("daemon.sock")).await;
  let _ = tokio::fs::remove_file(daemon_dir.join("daemon.pid")).await;
}

#[cfg(not(unix))]
async fn kill_orphaned_codegraph(_project_path: &str) {}

#[tauri::command]
pub async fn mcp_stop(server_id: String) -> Result<(), String> {
  let process = {
    let mut processes = MCP_PROCESSES.lock().await;
    processes.remove(&server_id)
  };

  if let Some(process) = process {
    let mut guard = process.lock().await;
    #[cfg(unix)]
    {
      if let Some(pid) = guard.child.id() {
        let pgid = pid as i32;
        unsafe {
          let _ = libc::killpg(pgid, libc::SIGTERM);
        }
        tokio::time::sleep(Duration::from_millis(150)).await;
        unsafe {
          let _ = libc::killpg(pgid, libc::SIGKILL);
        }
      }
    }
    let _ = guard.child.kill().await;
    let _ = guard.child.wait().await;
  }

  set_state(&server_id, "stopped", None, vec![], None).await;
  Ok(())
}

#[tauri::command]
pub async fn mcp_refresh(server_id: String) -> Result<McpServerState, String> {
  set_state(&server_id, "refreshing", None, vec![], None).await;

  let process = {
    let processes = MCP_PROCESSES.lock().await;
    processes.get(&server_id).cloned()
  };

  let Some(process) = process else {
    return Err("Server not running".to_string());
  };

  let tools = list_tools_internal(&process).await?;
  set_state(&server_id, "connected", None, tools.clone(), None).await;

  let icons = {
    let states = MCP_STATES.lock().await;
    states.get(&server_id).and_then(|state| state.icons.clone())
  };

  Ok(McpServerState {
    server_id: server_id.clone(),
    status: "connected".to_string(),
    error: None,
    tools,
    icons,
  })
}

#[tauri::command]
pub async fn mcp_logout(server_id: String) -> Result<(), String> {
  mcp_stop(server_id.clone()).await?;
  set_state(&server_id, "auth_required", None, vec![], None).await;
  Ok(())
}

#[tauri::command]
pub async fn mcp_list_tools(server_id: String) -> Result<Vec<McpToolInfo>, String> {
  let state = mcp_status(server_id.clone()).await?;
  Ok(state.tools)
}

async fn sync_process_liveness(server_id: &str) -> Option<McpServerState> {
  let process = {
    let processes = MCP_PROCESSES.lock().await;
    processes.get(server_id).cloned()
  };

  if let Some(process) = process {
    let is_running = {
      let mut guard = process.lock().await;
      matches!(guard.child.try_wait(), Ok(None))
    };

    if is_running {
      let states = MCP_STATES.lock().await;
      return states.get(server_id).cloned();
    }

    let mut processes = MCP_PROCESSES.lock().await;
    processes.remove(server_id);
    drop(processes);
    set_state(server_id, "stopped", None, vec![], None).await;
    let states = MCP_STATES.lock().await;
    return states.get(server_id).cloned();
  }

  let should_mark_stopped = {
    let states = MCP_STATES.lock().await;
    states.get(server_id).map(|state| {
      state.status == "connected"
        || state.status == "starting"
        || state.status == "refreshing"
    })
  };

  if should_mark_stopped == Some(true) {
    set_state(server_id, "stopped", None, vec![], None).await;
  }

  let states = MCP_STATES.lock().await;
  states.get(server_id).cloned()
}

#[tauri::command]
pub async fn mcp_status(server_id: String) -> Result<McpServerState, String> {
  if let Some(state) = sync_process_liveness(&server_id).await {
    return Ok(state);
  }
  Ok(McpServerState {
    server_id,
    status: "stopped".to_string(),
    error: None,
    tools: vec![],
    icons: None,
  })
}

#[tauri::command]
pub async fn mcp_list_statuses() -> Result<HashMap<String, McpServerState>, String> {
  let state_ids: Vec<String> = {
    let states = MCP_STATES.lock().await;
    states.keys().cloned().collect()
  };
  let process_ids: Vec<String> = {
    let processes = MCP_PROCESSES.lock().await;
    processes.keys().cloned().collect()
  };

  let mut all_ids: std::collections::HashSet<String> = state_ids.into_iter().collect();
  all_ids.extend(process_ids);

  let mut result = HashMap::new();
  for id in all_ids {
    if let Some(state) = sync_process_liveness(&id).await {
      result.insert(id, state);
    }
  }

  Ok(result)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn mcp_command_allowlist() {
    assert!(validate_mcp_spawn("npx", &[]).is_ok());
    assert!(validate_mcp_spawn("uvx", &["some-server".into()]).is_ok());
    assert!(validate_mcp_spawn("codegraph", &["serve".into(), "--mcp".into()]).is_ok());
    assert!(validate_mcp_spawn("CODEGRAPH", &["serve".into(), "--mcp".into()]).is_ok());
    assert!(validate_mcp_spawn("/usr/bin/npx", &[]).is_err());
    assert!(validate_mcp_spawn("/usr/local/bin/codegraph", &[]).is_err());
    assert!(validate_mcp_spawn("bash", &["-c".into(), "id".into()]).is_err());
    assert!(validate_mcp_spawn("npx", &["ok\0evil".into()]).is_err());
  }

  #[test]
  fn mcp_env_overlay_allows_codegraph_keys() {
    let mut env = HashMap::new();
    env.insert("CODEGRAPH_MCP_TOOLS".into(), "explore,node".into());
    env.insert("CODEGRAPH_TELEMETRY".into(), "0".into());
    assert!(validate_mcp_env(&env).is_ok());
  }

  #[test]
  fn mcp_env_overlay_denies_dangerous_keys() {
    let mut env = HashMap::new();
    env.insert("PATH".into(), "/evil".into());
    assert!(validate_mcp_env(&env).is_err());
  }
}

#[tauri::command]
pub async fn mcp_call_tool(
  server_id: String,
  tool: String,
  args: serde_json::Value,
) -> Result<serde_json::Value, String> {
  let process = {
    let processes = MCP_PROCESSES.lock().await;
    processes.get(&server_id).cloned()
  };

  let Some(process) = process else {
    return Err("Server not running".to_string());
  };

  let response = json_rpc(
    &process,
    "tools/call",
    serde_json::json!({
      "name": tool,
      "arguments": args,
    }),
  )
  .await?;

  if let Some(error) = response.get("error") {
    let message = error
      .get("message")
      .and_then(|m| m.as_str())
      .unwrap_or("tools/call failed")
      .to_string();
    return Err(message);
  }

  Ok(response.get("result").cloned().unwrap_or(serde_json::Value::Null))
}
