use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LspServerStatus {
  pub id: String,
  pub running: bool,
  pub error: Option<String>,
}

#[tauri::command]
pub fn lsp_status() -> Result<Vec<LspServerStatus>, String> {
  Ok(vec![])
}

#[tauri::command]
pub fn lsp_request(
  _server_id: String,
  _method: String,
  _params: serde_json::Value,
) -> Result<serde_json::Value, String> {
  Err("LSP not started".to_string())
}

#[tauri::command]
pub fn lsp_ensure_server(_extension: String) -> Result<LspServerStatus, String> {
  Err("LSP disabled".to_string())
}

#[tauri::command]
pub fn lsp_stop_server(_server_id: String) -> Result<(), String> {
  Ok(())
}
