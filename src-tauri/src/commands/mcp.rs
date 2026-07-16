use std::collections::HashMap;
use std::process::Stdio;

use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::{oneshot, Mutex};

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpToolInfo {
  pub name: String,
  pub description: Option<String>,
  pub input_schema: Option<serde_json::Value>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServerState {
  pub server_id: String,
  pub status: String,
  pub error: Option<String>,
  pub tools: Vec<McpToolInfo>,
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

async fn set_state(server_id: &str, status: &str, error: Option<String>, tools: Vec<McpToolInfo>) {
  let mut states = MCP_STATES.lock().await;
  states.insert(
    server_id.to_string(),
    McpServerState {
      server_id: server_id.to_string(),
      status: status.to_string(),
      error,
      tools,
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
      stdin.write_all(line.as_bytes()).await.map_err(|e| e.to_string())?;
      stdin.flush().await.map_err(|e| e.to_string())?;
    } else {
      return Err("MCP process stdin unavailable".to_string());
    }
  }

  rx.await.map_err(|_| "MCP request cancelled".to_string())
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
      if let Some(id) = value.get("id").and_then(|v| v.as_u64()) {
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
    set_state(&server_id, "stopped", None, vec![]).await;
    let mut processes = MCP_PROCESSES.lock().await;
    processes.remove(&server_id);
  });
}

#[tauri::command]
pub async fn mcp_start(
  server_id: String,
  command: String,
  args: Vec<String>,
) -> Result<McpServerState, String> {
  mcp_stop(server_id.clone()).await.ok();

  set_state(&server_id, "starting", None, vec![]).await;

  let child = Command::new(&command)
    .args(&args)
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::null())
    .kill_on_drop(true)
    .spawn()
    .map_err(|e| e.to_string())?;

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

  let init = json_rpc(
    &process,
    "initialize",
    serde_json::json!({
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": { "name": "pyrola", "version": "0.1.0" }
    }),
  )
  .await?;

  if init.get("error").is_some() {
    let message = init
      .get("error")
      .and_then(|e| e.get("message"))
      .and_then(|m| m.as_str())
      .unwrap_or("initialize failed")
      .to_string();
    set_state(&server_id, "error", Some(message.clone()), vec![]).await;
    return Err(message);
  }

  let tools = list_tools_internal(&process).await?;
  set_state(&server_id, "connected", None, tools.clone()).await;

  Ok(McpServerState {
    server_id,
    status: "connected".to_string(),
    error: None,
    tools,
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
        })
      })
      .collect(),
  )
}

#[tauri::command]
pub async fn mcp_stop(server_id: String) -> Result<(), String> {
  let process = {
    let mut processes = MCP_PROCESSES.lock().await;
    processes.remove(&server_id)
  };

  if let Some(process) = process {
    let mut guard = process.lock().await;
    let _ = guard.child.kill().await;
  }

  set_state(&server_id, "stopped", None, vec![]).await;
  Ok(())
}

#[tauri::command]
pub async fn mcp_refresh(server_id: String) -> Result<McpServerState, String> {
  set_state(&server_id, "refreshing", None, vec![]).await;

  let process = {
    let processes = MCP_PROCESSES.lock().await;
    processes.get(&server_id).cloned()
  };

  let Some(process) = process else {
    return Err("Server not running".to_string());
  };

  let tools = list_tools_internal(&process).await?;
  set_state(&server_id, "connected", None, tools.clone()).await;

  Ok(McpServerState {
    server_id: server_id.clone(),
    status: "connected".to_string(),
    error: None,
    tools,
  })
}

#[tauri::command]
pub async fn mcp_logout(server_id: String) -> Result<(), String> {
  mcp_stop(server_id.clone()).await?;
  set_state(&server_id, "auth_required", None, vec![]).await;
  Ok(())
}

#[tauri::command]
pub async fn mcp_list_tools(server_id: String) -> Result<Vec<McpToolInfo>, String> {
  let state = mcp_status(server_id.clone()).await?;
  Ok(state.tools)
}

#[tauri::command]
pub async fn mcp_status(server_id: String) -> Result<McpServerState, String> {
  let states = MCP_STATES.lock().await;
  states
    .get(&server_id)
    .cloned()
    .ok_or_else(|| "Unknown server".to_string())
}
