use serde::{Deserialize, Serialize};
use tokio::process::Command;

use super::fs::{canonical_project_root, resolve_workspace_path};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceGrepRequest {
  pub project_root: String,
  pub pattern: String,
  #[serde(default)]
  pub path: Option<String>,
  #[serde(default)]
  pub glob: Option<String>,
  #[serde(default)]
  pub case_insensitive: Option<bool>,
  #[serde(default)]
  pub context: Option<u32>,
  #[serde(default)]
  pub max_results: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GrepMatch {
  pub path: String,
  pub line_number: u32,
  pub line: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub context_before: Option<Vec<String>>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub context_after: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceGrepResult {
  pub matches: Vec<GrepMatch>,
  pub truncated: bool,
}

#[tauri::command]
pub async fn workspace_grep(request: WorkspaceGrepRequest) -> Result<WorkspaceGrepResult, String> {
  if request.pattern.trim().is_empty() {
    return Err("Search pattern is required".to_string());
  }

  let root = canonical_project_root(&request.project_root)?;
  let search_path = match request.path.as_deref() {
    Some(path) => resolve_workspace_path(&request.project_root, path)?,
    None => root.clone(),
  };

  let mut command = Command::new("rg");
  command
    .arg("--json")
    .arg("--regexp")
    .arg(&request.pattern)
    .arg("--no-heading");

  if request.case_insensitive.unwrap_or(false) {
    command.arg("--ignore-case");
  }

  if let Some(glob) = request.glob.as_deref().filter(|value| !value.trim().is_empty()) {
    command.arg("--glob").arg(glob);
  }

  if let Some(context) = request.context {
    command.arg("--context").arg(context.to_string());
  }

  let max_results = request.max_results.unwrap_or(200);
  command.arg("--max-count").arg(max_results.to_string());
  command.arg(search_path);

  let output = command
    .output()
    .await
    .map_err(|error| format!("Failed to run rg: {error}"))?;

  if !output.status.success() && output.status.code() != Some(1) {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    return Err(if stderr.is_empty() {
      format!("rg failed with status {}", output.status)
    } else {
      stderr
    });
  }

  let stdout = String::from_utf8_lossy(&output.stdout);
  let mut matches = Vec::new();
  let mut truncated = false;

  for line in stdout.lines() {
    if line.trim().is_empty() {
      continue;
    }
    let parsed: serde_json::Value = serde_json::from_str(line).map_err(|error| error.to_string())?;
    let kind = parsed
      .get("type")
      .and_then(|value| value.as_str())
      .unwrap_or_default();
    if kind != "match" {
      continue;
    }
    let data = parsed
      .get("data")
      .ok_or_else(|| "rg output missing data field".to_string())?;
    let path_text = data
      .get("path")
      .and_then(|value| value.get("text"))
      .and_then(|value| value.as_str())
      .ok_or_else(|| "rg output missing path".to_string())?;
    let line_number = data
      .get("line_number")
      .and_then(|value| value.as_u64())
      .unwrap_or(0) as u32;
    let line_text = data
      .get("lines")
      .and_then(|value| value.get("text"))
      .and_then(|value| value.as_str())
      .unwrap_or_default()
      .trim_end_matches('\n')
      .to_string();

    let rel_path = std::path::Path::new(path_text)
      .strip_prefix(&root)
      .map(|value| value.to_string_lossy().to_string())
      .unwrap_or_else(|_| path_text.to_string());

    matches.push(GrepMatch {
      path: rel_path,
      line_number,
      line: line_text,
      context_before: None,
      context_after: None,
    });
    if matches.len() >= max_results as usize {
      truncated = true;
      break;
    }
  }

  Ok(WorkspaceGrepResult { matches, truncated })
}
