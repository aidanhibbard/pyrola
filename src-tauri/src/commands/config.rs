use std::fs;
use std::path::PathBuf;

use tauri::AppHandle;

use super::paths::{resolve_project_pyrola_dir, user_pyrola_dir};

fn read_json(path: &PathBuf) -> Result<serde_json::Value, String> {
  if !path.exists() {
    return Ok(serde_json::json!({}));
  }
  let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
  if content.trim().is_empty() {
    return Ok(serde_json::json!({}));
  }
  serde_json::from_str(&content).map_err(|e| e.to_string())
}

fn write_json(path: &PathBuf, value: serde_json::Value) -> Result<(), String> {
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  let content = serde_json::to_string_pretty(&value).map_err(|e| e.to_string())?;
  fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_settings(app: AppHandle, scope: String, root_path: Option<String>) -> Result<serde_json::Value, String> {
  let path = settings_path(&app, &scope, root_path)?;
  read_json(&path)
}

#[tauri::command]
pub fn write_settings(
  app: AppHandle,
  scope: String,
  root_path: Option<String>,
  settings: serde_json::Value,
) -> Result<(), String> {
  let path = settings_path(&app, &scope, root_path)?;
  write_json(&path, settings)
}

#[tauri::command]
pub fn read_mcp_config(app: AppHandle, scope: String, root_path: Option<String>) -> Result<serde_json::Value, String> {
  let path = mcp_path(&app, &scope, root_path)?;
  read_json(&path)
}

#[tauri::command]
pub fn write_mcp_config(
  app: AppHandle,
  scope: String,
  root_path: Option<String>,
  config: serde_json::Value,
) -> Result<(), String> {
  let path = mcp_path(&app, &scope, root_path)?;
  write_json(&path, config)
}

#[tauri::command]
pub fn read_json_file(path: String) -> Result<serde_json::Value, String> {
  read_json(&PathBuf::from(path))
}

#[tauri::command]
pub fn write_json_file(path: String, value: serde_json::Value) -> Result<(), String> {
  write_json(&PathBuf::from(path), value)
}

#[tauri::command]
pub fn config_exists(app: AppHandle, scope: String, root_path: Option<String>) -> Result<bool, String> {
  let path = settings_path(&app, &scope, root_path)?;
  Ok(path.exists())
}

fn settings_path(app: &AppHandle, scope: &str, root_path: Option<String>) -> Result<PathBuf, String> {
  base_path(app, scope, root_path).map(|p| p.join("settings.json"))
}

pub(crate) fn tray_background_enabled(app: &AppHandle) -> bool {
  let path = match settings_path(app, "personal", None) {
    Ok(path) => path,
    Err(error) => {
      log::warn!("Failed to resolve personal settings path: {error}");
      return false;
    }
  };

  let settings = match read_json(&path) {
    Ok(settings) => settings,
    Err(error) => {
      log::warn!("Failed to read personal settings: {error}");
      return false;
    }
  };

  settings
    .get("fleet.trayBackground")
    .and_then(|value| value.as_bool())
    .unwrap_or(false)
}

fn mcp_path(app: &AppHandle, scope: &str, root_path: Option<String>) -> Result<PathBuf, String> {
  base_path(app, scope, root_path).map(|p| p.join("mcp.json"))
}

fn lsp_path(app: &AppHandle, scope: &str, root_path: Option<String>) -> Result<PathBuf, String> {
  base_path(app, scope, root_path).map(|p| p.join("lsp.json"))
}

pub(crate) fn read_lsp_config(
  app: &AppHandle,
  scope: &str,
  root_path: Option<String>,
) -> Result<serde_json::Value, String> {
  let path = lsp_path(app, scope, root_path)?;
  read_json(&path)
}

pub(crate) fn read_lsp_scope_configs(
  app: &AppHandle,
  project_root: Option<String>,
) -> Result<(serde_json::Value, serde_json::Value), String> {
  let personal = read_lsp_config(app, "personal", None)?;
  let project = match project_root {
    Some(root) => read_lsp_config(app, "project", Some(root))?,
    None => serde_json::json!({}),
  };
  Ok((personal, project))
}

pub(crate) fn lsp_enabled_in_settings(
  app: &AppHandle,
  project_root: Option<&str>,
) -> bool {
  let personal = match read_settings_internal(app, "personal", None) {
    Ok(settings) => settings,
    Err(error) => {
      log::warn!("Failed to read personal settings for LSP: {error}");
      return false;
    }
  };

  let mut enabled = personal
    .get("lsp.enabled")
    .and_then(|value| value.as_bool())
    .unwrap_or(false);

  if let Some(root) = project_root {
    if let Ok(project_settings) = read_settings_internal(app, "project", Some(root.to_string())) {
      if let Some(value) = project_settings.get("lsp.enabled").and_then(|v| v.as_bool()) {
        enabled = value;
      }
    }
  }

  enabled
}

fn read_settings_internal(
  app: &AppHandle,
  scope: &str,
  root_path: Option<String>,
) -> Result<serde_json::Value, String> {
  let path = settings_path(app, scope, root_path)?;
  read_json(&path)
}

fn base_path(app: &AppHandle, scope: &str, root_path: Option<String>) -> Result<PathBuf, String> {
  match scope {
    "personal" => user_pyrola_dir(app),
    "project" => {
      let root = root_path.ok_or_else(|| "root_path required for project scope".to_string())?;
      let dir = resolve_project_pyrola_dir(&root);
      fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
      Ok(dir)
    }
    other => Err(format!("unknown scope: {other}")),
  }
}
