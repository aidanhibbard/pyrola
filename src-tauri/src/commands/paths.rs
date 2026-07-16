use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

const PYROLA_DIR: &str = ".pyrola";

pub fn user_pyrola_dir(app: &AppHandle) -> Result<PathBuf, String> {
  let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
  let dir = app_data.join(PYROLA_DIR);
  fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  Ok(dir)
}

pub fn project_pyrola_dir(root_path: &str) -> PathBuf {
  Path::new(root_path).join(PYROLA_DIR)
}

fn pyrola_dir_has_config(pyrola_dir: &Path) -> bool {
  pyrola_dir.join("mcp.json").exists() || pyrola_dir.join("settings.json").exists()
}

pub fn resolve_project_pyrola_dir(root_path: &str) -> PathBuf {
  let mut current = PathBuf::from(root_path);
  let mut fallback = project_pyrola_dir(root_path);

  for _ in 0..8 {
    let pyrola_dir = current.join(PYROLA_DIR);
    if pyrola_dir.is_dir() {
      fallback = pyrola_dir.clone();
      if pyrola_dir_has_config(&pyrola_dir) {
        return pyrola_dir;
      }
    }
    if !current.pop() {
      break;
    }
  }

  fallback
}

fn find_workspace_root(mut dir: PathBuf) -> PathBuf {
  for _ in 0..8 {
    if dir.join("package.json").exists()
      && (dir.join("src-tauri").exists() || dir.join(PYROLA_DIR).exists())
    {
      return dir;
    }
    if !dir.pop() {
      break;
    }
  }

  dir
}

#[tauri::command]
pub fn get_user_pyrola_dir(app: AppHandle) -> Result<String, String> {
  user_pyrola_dir(&app).map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn has_project_pyrola(root_path: String) -> Result<bool, String> {
  let pyrola_dir = resolve_project_pyrola_dir(&root_path);
  Ok(pyrola_dir.is_dir() && pyrola_dir_has_config(&pyrola_dir))
}

#[tauri::command]
pub fn get_default_workspace_root() -> String {
  match std::env::current_dir() {
    Ok(dir) => find_workspace_root(dir).to_string_lossy().to_string(),
    Err(_) => "/".to_string(),
  }
}

#[derive(serde::Serialize)]
pub struct ProjectFileEntry {
  pub name: String,
  pub path: String,
  pub description: Option<String>,
}

#[tauri::command]
pub fn get_pyrola_dir(
  app: AppHandle,
  scope: String,
  root_path: Option<String>,
) -> Result<String, String> {
  pyrola_base_dir(&app, &scope, root_path).map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn list_pyrola_files(
  app: AppHandle,
  scope: String,
  kind: String,
  root_path: Option<String>,
) -> Result<Vec<ProjectFileEntry>, String> {
  let base = pyrola_base_dir(&app, &scope, root_path)?;
  list_files_for_kind(&base, &kind)
}

#[tauri::command]
pub fn list_project_files(root_path: String, kind: String) -> Result<Vec<ProjectFileEntry>, String> {
  let base = resolve_project_pyrola_dir(&root_path);
  list_files_for_kind(&base, &kind)
}

fn pyrola_base_dir(app: &AppHandle, scope: &str, root_path: Option<String>) -> Result<PathBuf, String> {
  match scope {
    "personal" => user_pyrola_dir(app),
    "project" => {
      let root = root_path.ok_or_else(|| "root_path required for project scope".to_string())?;
      Ok(resolve_project_pyrola_dir(&root))
    }
    other => Err(format!("unknown scope: {other}")),
  }
}

fn list_files_for_kind(base: &Path, kind: &str) -> Result<Vec<ProjectFileEntry>, String> {
  match kind {
    "agents" | "rules" => list_flat_markdown_files(&base.join(kind)),
    "skills" => list_skill_files(&base.join("skills")),
    "plans" => list_nested_markdown_files(&base.join("plans"), "PLAN.md"),
    "studio" => list_nested_markdown_files(&base.join("studio"), "index.md"),
    _ => Err(format!("unknown kind: {kind}")),
  }
}

fn list_skill_files(dir: &Path) -> Result<Vec<ProjectFileEntry>, String> {
  if !dir.exists() {
    return Ok(vec![]);
  }

  let mut entries = Vec::new();
  for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
    let entry = entry.map_err(|e| e.to_string())?;
    if !entry.file_type().map_err(|e| e.to_string())?.is_dir() {
      continue;
    }
    let skill_md = entry.path().join("SKILL.md");
    if !skill_md.exists() {
      continue;
    }
    let name = entry.file_name().to_string_lossy().to_string();
    let description = read_first_description(&skill_md);
    entries.push(ProjectFileEntry {
      name,
      path: skill_md.to_string_lossy().to_string(),
      description,
    });
  }

  entries.sort_by(|a, b| a.name.cmp(&b.name));
  Ok(entries)
}

fn list_nested_markdown_files(dir: &Path, file_name: &str) -> Result<Vec<ProjectFileEntry>, String> {
  if !dir.exists() {
    return Ok(vec![]);
  }

  let mut entries = Vec::new();
  for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
    let entry = entry.map_err(|e| e.to_string())?;
    if !entry.file_type().map_err(|e| e.to_string())?.is_dir() {
      continue;
    }
    let file_path = entry.path().join(file_name);
    if !file_path.exists() {
      continue;
    }
    let name = entry.file_name().to_string_lossy().to_string();
    let description = read_first_description(&file_path);
    entries.push(ProjectFileEntry {
      name,
      path: file_path.to_string_lossy().to_string(),
      description,
    });
  }

  entries.sort_by(|a, b| a.name.cmp(&b.name));
  Ok(entries)
}

fn list_flat_markdown_files(dir: &Path) -> Result<Vec<ProjectFileEntry>, String> {
  if !dir.exists() {
    return Ok(vec![]);
  }

  let mut entries = Vec::new();
  for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
    let entry = entry.map_err(|e| e.to_string())?;
    let path = entry.path();
    if path.extension().and_then(|e| e.to_str()) != Some("md") {
      continue;
    }
    let name = entry.file_name().to_string_lossy().to_string();
    let description = read_first_description(&path);
    entries.push(ProjectFileEntry {
      name,
      path: path.to_string_lossy().to_string(),
      description,
    });
  }

  entries.sort_by(|a, b| a.name.cmp(&b.name));
  Ok(entries)
}

fn read_first_description(path: &Path) -> Option<String> {
  let content = fs::read_to_string(path).ok()?;
  for line in content.lines() {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with("---") {
      continue;
    }
    return Some(trimmed.chars().take(120).collect());
  }
  None
}
