use std::time::UNIX_EPOCH;

use serde::{Deserialize, Serialize};
use tokio::process::Command;

use super::fs::canonical_project_root;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceGlobRequest {
  pub project_root: String,
  pub pattern: String,
  #[serde(default)]
  pub limit: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobFileEntry {
  pub path: String,
  pub modified_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceGlobResult {
  pub files: Vec<GlobFileEntry>,
  pub truncated: bool,
}

#[tauri::command]
pub async fn workspace_glob(request: WorkspaceGlobRequest) -> Result<WorkspaceGlobResult, String> {
  if request.pattern.trim().is_empty() {
    return Err("Glob pattern is required".to_string());
  }

  let root = canonical_project_root(&request.project_root)?;
  let limit = request.limit.unwrap_or(500) as usize;

  let output = Command::new("rg")
    .arg("--files")
    .arg("-g")
    .arg(&request.pattern)
    .arg(&root)
    .output()
    .await
    .map_err(|error| format!("Failed to run rg: {error}"))?;

  if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    return Err(if stderr.is_empty() {
      format!("rg failed with status {}", output.status)
    } else {
      stderr
    });
  }

  let stdout = String::from_utf8_lossy(&output.stdout);
  let mut files = Vec::new();

  for line in stdout.lines() {
    let path = std::path::PathBuf::from(line.trim());
    if path.strip_prefix(&root).is_err() {
      continue;
    }
    let rel = path
      .strip_prefix(&root)
      .map(|value| value.to_string_lossy().to_string())
      .unwrap_or_else(|_| line.trim().to_string());
    let modified_ms = std::fs::metadata(&path)
      .ok()
      .and_then(|meta| meta.modified().ok())
      .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
      .map(|duration| duration.as_millis() as u64);
    files.push(GlobFileEntry {
      path: rel,
      modified_ms,
    });
  }

  files.sort_by(|left, right| right.modified_ms.cmp(&left.modified_ms).then_with(|| left.path.cmp(&right.path)));

  let truncated = files.len() > limit;
  files.truncate(limit);

  Ok(WorkspaceGlobResult { files, truncated })
}
