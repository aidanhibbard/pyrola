use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FsReadFileResult {
  pub path: String,
  pub content: String,
  pub total_lines: u32,
  pub offset: u32,
  pub limit: u32,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub is_image: Option<bool>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub mime_type: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub size_bytes: Option<u64>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub base64: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FsDirEntry {
  pub name: String,
  pub path: String,
  pub kind: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FsTreeNode {
  pub name: String,
  pub path: String,
  pub kind: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub children: Option<Vec<FsTreeNode>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FsStatResult {
  pub path: String,
  pub exists: bool,
  pub kind: String,
  pub size: u64,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub modified_ms: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsEditReplacement {
  pub old_string: String,
  pub new_string: String,
  #[serde(default)]
  pub replace_all: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
  pub kind: String,
  pub content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDiffHunk {
  pub old_start: u32,
  pub new_start: u32,
  pub lines: Vec<DiffLine>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDiff {
  pub path: String,
  pub operation: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub old_content: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub new_content: Option<String>,
  pub hunks: Vec<FileDiffHunk>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum FsStagePreviewRequest {
  Write { path: String, content: String },
  Edit {
    path: String,
    replacements: Vec<FsEditReplacement>,
  },
  ApplyPatch { patch: String },
  Delete { path: String },
}

pub(crate) fn canonical_project_root(project_root: &str) -> Result<PathBuf, String> {
  let root = PathBuf::from(project_root);
  let canonical = root
    .canonicalize()
    .map_err(|error| format!("Invalid project root: {error}"))?;
  if !canonical.is_dir() {
    return Err("Project root is not a directory".to_string());
  }
  Ok(canonical)
}

pub(crate) fn resolve_workspace_path(project_root: &str, user_path: &str) -> Result<PathBuf, String> {
  let root = canonical_project_root(project_root)?;
  let trimmed = user_path.trim();
  if trimmed.is_empty() {
    return Err("Path is required".to_string());
  }

  let relative = Path::new(trimmed);
  if relative.is_absolute() {
    return Err("Path must be relative to the project root".to_string());
  }

  let mut joined = root.clone();
  for component in relative.components() {
    match component {
      Component::Normal(part) => joined.push(part),
      Component::CurDir => {}
      Component::ParentDir => return Err("Path traversal is not allowed".to_string()),
      Component::RootDir | Component::Prefix(_) => {
        return Err("Invalid path component".to_string());
      }
    }
  }

  ensure_under_root(&root, &joined)
}

fn ensure_under_root(root: &Path, target: &Path) -> Result<PathBuf, String> {
  if target.exists() {
    let canonical = target
      .canonicalize()
      .map_err(|error| format!("Failed to resolve path: {error}"))?;
    if !canonical.starts_with(root) {
      return Err("Path escapes project root".to_string());
    }
    return Ok(canonical);
  }

  let mut probe = target.to_path_buf();
  loop {
    if probe.exists() {
      let canonical = probe
        .canonicalize()
        .map_err(|error| format!("Failed to resolve path: {error}"))?;
      if !canonical.starts_with(root) {
        return Err("Path escapes project root".to_string());
      }
      return Ok(target.to_path_buf());
    }
    if !probe.pop() {
      break;
    }
  }

  if target.starts_with(root) {
    return Ok(target.to_path_buf());
  }

  Err("Path escapes project root".to_string())
}

fn relative_path(root: &Path, absolute: &Path) -> String {
  absolute
    .strip_prefix(root)
    .map(|p| p.to_string_lossy().to_string())
    .unwrap_or_else(|_| absolute.to_string_lossy().to_string())
}

fn entry_kind(path: &Path) -> Result<String, String> {
  let meta = fs::symlink_metadata(path).map_err(|error| error.to_string())?;
  if meta.is_dir() {
    Ok("directory".to_string())
  } else if meta.is_file() {
    Ok("file".to_string())
  } else if meta.file_type().is_symlink() {
    Ok("symlink".to_string())
  } else {
    Ok("other".to_string())
  }
}

fn modified_ms(path: &Path) -> Option<u64> {
  fs::metadata(path)
    .ok()
    .and_then(|meta| meta.modified().ok())
    .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
    .map(|duration| duration.as_millis() as u64)
}

fn build_file_diff(
  path: String,
  operation: &str,
  old_content: Option<String>,
  new_content: Option<String>,
) -> FileDiff {
  let old = old_content.as_deref().unwrap_or("");
  let new = new_content.as_deref().unwrap_or("");
  let hunks = build_hunks(old, new);
  FileDiff {
    path,
    operation: operation.to_string(),
    old_content,
    new_content,
    hunks,
  }
}

fn build_hunks(old: &str, new: &str) -> Vec<FileDiffHunk> {
  if old == new {
    return vec![];
  }

  let old_lines: Vec<&str> = if old.is_empty() {
    vec![]
  } else {
    old.lines().collect()
  };
  let new_lines: Vec<&str> = if new.is_empty() {
    vec![]
  } else {
    new.lines().collect()
  };

  let mut lines = Vec::new();
  for line in &old_lines {
    lines.push(DiffLine {
      kind: "remove".to_string(),
      content: (*line).to_string(),
    });
  }
  for line in &new_lines {
    lines.push(DiffLine {
      kind: "add".to_string(),
      content: (*line).to_string(),
    });
  }

  vec![FileDiffHunk {
    old_start: if old_lines.is_empty() { 0 } else { 1 },
    new_start: if new_lines.is_empty() { 0 } else { 1 },
    lines,
  }]
}

fn apply_replacements(content: &str, replacements: &[FsEditReplacement]) -> Result<String, String> {
  let mut updated = content.to_string();
  for replacement in replacements {
    if replacement.old_string.is_empty() {
      return Err("Replacement old_string cannot be empty".to_string());
    }
    if replacement.replace_all {
      if !updated.contains(&replacement.old_string) {
        return Err("old_string was not found in file".to_string());
      }
      updated = updated.replace(&replacement.old_string, &replacement.new_string);
      continue;
    }
    let count = updated.matches(&replacement.old_string).count();
    if count == 0 {
      return Err("old_string was not found in file".to_string());
    }
    if count > 1 {
      return Err("old_string is not unique; enable replace_all or provide more context".to_string());
    }
    updated = updated.replacen(&replacement.old_string, &replacement.new_string, 1);
  }
  Ok(updated)
}

#[derive(Debug)]
enum PatchOperation {
  Add { path: String, content: String },
  Update { path: String, content: String },
  Delete { path: String },
}

fn parse_patch(patch: &str) -> Result<Vec<PatchOperation>, String> {
  let trimmed = patch.trim();
  if trimmed.is_empty() {
    return Err("Patch is empty".to_string());
  }

  let lines: Vec<&str> = trimmed.lines().collect();
  let mut index = 0usize;
  if lines.first().is_some_and(|line| line.trim() == "*** Begin Patch") {
    index = 1;
  }

  let mut operations = Vec::new();
  while index < lines.len() {
    let line = lines[index].trim();
    if line == "*** End Patch" {
      break;
    }
    if line.is_empty() {
      index += 1;
      continue;
    }

    if let Some(path) = line.strip_prefix("*** Add File:") {
      let path = path.trim().to_string();
      index += 1;
      let mut content = String::new();
      while index < lines.len() {
        let next = lines[index];
        if next.trim().starts_with("*** ") {
          break;
        }
        if let Some(rest) = next.strip_prefix('+') {
          if !content.is_empty() {
            content.push('\n');
          }
          content.push_str(rest);
        } else if next.trim().is_empty() {
          content.push('\n');
        } else {
          return Err(format!("Invalid add file line in patch: {next}"));
        }
        index += 1;
      }
      operations.push(PatchOperation::Add { path, content });
      continue;
    }

    if let Some(path) = line.strip_prefix("*** Update File:") {
      let path = path.trim().to_string();
      index += 1;
      let mut content = String::new();
      while index < lines.len() {
        let next = lines[index];
        if next.trim().starts_with("*** ") {
          break;
        }
        if !content.is_empty() {
          content.push('\n');
        }
        content.push_str(next);
        index += 1;
      }
      operations.push(PatchOperation::Update { path, content });
      continue;
    }

    if let Some(path) = line.strip_prefix("*** Delete File:") {
      operations.push(PatchOperation::Delete {
        path: path.trim().to_string(),
      });
      index += 1;
      continue;
    }

    return Err(format!("Unrecognized patch header: {line}"));
  }

  if operations.is_empty() {
    return Err("Patch contains no file operations".to_string());
  }

  Ok(operations)
}

fn apply_update_patch(existing: &str, patched: &str) -> Result<String, String> {
  let mut result = String::new();
  let mut old_index = 0usize;
  let old_lines: Vec<&str> = existing.lines().collect();
  let patch_lines: Vec<&str> = patched.lines().collect();
  let mut patch_index = 0usize;

  while patch_index < patch_lines.len() {
    let line = patch_lines[patch_index];
    if line.starts_with("@@") {
      patch_index += 1;
      continue;
    }
    if let Some(removed) = line.strip_prefix('-') {
      if old_index >= old_lines.len() || old_lines[old_index] != removed {
        return Err("Patch context does not match file contents".to_string());
      }
      old_index += 1;
      patch_index += 1;
      continue;
    }
    if let Some(added) = line.strip_prefix('+') {
      if !result.is_empty() {
        result.push('\n');
      }
      result.push_str(added);
      patch_index += 1;
      continue;
    }
    if old_index < old_lines.len() && old_lines[old_index] == line {
      if !result.is_empty() {
        result.push('\n');
      }
      result.push_str(line);
      old_index += 1;
      patch_index += 1;
      continue;
    }
    return Err("Patch context does not match file contents".to_string());
  }

  while old_index < old_lines.len() {
    if !result.is_empty() {
      result.push('\n');
    }
    result.push_str(old_lines[old_index]);
    old_index += 1;
  }

  Ok(result)
}

fn preview_patch(project_root: &str, patch: &str) -> Result<Vec<FileDiff>, String> {
  let root = canonical_project_root(project_root)?;
  let operations = parse_patch(patch)?;
  let mut diffs = Vec::new();

  for operation in operations {
    match operation {
      PatchOperation::Add { path, content } => {
        let _ = resolve_workspace_path(project_root, &path)?;
        diffs.push(build_file_diff(path, "create", None, Some(content)));
      }
      PatchOperation::Update { path, content } => {
        let absolute = resolve_workspace_path(project_root, &path)?;
        let old_content = fs::read_to_string(&absolute).map_err(|error| error.to_string())?;
        let new_content = apply_update_patch(&old_content, &content)?;
        diffs.push(build_file_diff(
          relative_path(&root, &absolute),
          "update",
          Some(old_content),
          Some(new_content),
        ));
      }
      PatchOperation::Delete { path } => {
        let absolute = resolve_workspace_path(project_root, &path)?;
        let old_content = fs::read_to_string(&absolute).map_err(|error| error.to_string())?;
        diffs.push(build_file_diff(
          relative_path(&root, &absolute),
          "delete",
          Some(old_content),
          None,
        ));
      }
    }
  }

  Ok(diffs)
}

fn apply_patch_operations(project_root: &str, patch: &str) -> Result<Vec<FileDiff>, String> {
  let root = canonical_project_root(project_root)?;
  let operations = parse_patch(patch)?;
  let mut diffs = Vec::new();

  for operation in operations {
    match operation {
      PatchOperation::Add { path, content } => {
        let absolute = resolve_workspace_path(project_root, &path)?;
        if let Some(parent) = absolute.parent() {
          fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        fs::write(&absolute, &content).map_err(|error| error.to_string())?;
        diffs.push(build_file_diff(
          relative_path(&root, &absolute),
          "create",
          None,
          Some(content),
        ));
      }
      PatchOperation::Update { path, content } => {
        let absolute = resolve_workspace_path(project_root, &path)?;
        let old_content = fs::read_to_string(&absolute).map_err(|error| error.to_string())?;
        let new_content = apply_update_patch(&old_content, &content)?;
        fs::write(&absolute, &new_content).map_err(|error| error.to_string())?;
        diffs.push(build_file_diff(
          relative_path(&root, &absolute),
          "update",
          Some(old_content),
          Some(new_content),
        ));
      }
      PatchOperation::Delete { path } => {
        let absolute = resolve_workspace_path(project_root, &path)?;
        let old_content = fs::read_to_string(&absolute).map_err(|error| error.to_string())?;
        fs::remove_file(&absolute).map_err(|error| error.to_string())?;
        diffs.push(build_file_diff(
          relative_path(&root, &absolute),
          "delete",
          Some(old_content),
          None,
        ));
      }
    }
  }

  Ok(diffs)
}

fn image_mime_type(path: &Path) -> Option<&'static str> {
  match path
    .extension()
    .and_then(|value| value.to_str())
    .unwrap_or_default()
    .to_ascii_lowercase()
    .as_str()
  {
    "png" => Some("image/png"),
    "jpg" | "jpeg" => Some("image/jpeg"),
    "gif" => Some("image/gif"),
    "webp" => Some("image/webp"),
    "svg" => Some("image/svg+xml"),
    _ => None,
  }
}

fn is_image_path(path: &Path) -> bool {
  image_mime_type(path).is_some()
}

#[tauri::command]
pub fn fs_read_file(
  project_root: String,
  path: String,
  offset: Option<u32>,
  limit: Option<u32>,
  include_base64: Option<bool>,
) -> Result<FsReadFileResult, String> {
  let root = canonical_project_root(&project_root)?;
  let absolute = resolve_workspace_path(&project_root, &path)?;
  let rel = relative_path(&root, &absolute);

  if is_image_path(&absolute) {
    let metadata = fs::metadata(&absolute).map_err(|error| error.to_string())?;
    let mime_type = image_mime_type(&absolute).map(str::to_string);
    let is_svg = mime_type.as_deref() == Some("image/svg+xml");

    if is_svg {
      let content = fs::read_to_string(&absolute).map_err(|error| error.to_string())?;
      let lines: Vec<&str> = content.lines().collect();
      let total_lines = lines.len() as u32;
      let start = (offset.unwrap_or(1).saturating_sub(1) as usize).min(lines.len());
      let max = limit.unwrap_or(total_lines.max(1)) as usize;
      let end = start.saturating_add(max).min(lines.len());
      let slice = lines[start..end].join("\n");

      return Ok(FsReadFileResult {
        path: rel,
        content: slice,
        total_lines,
        offset: (start as u32) + 1,
        limit: (end - start) as u32,
        is_image: Some(true),
        mime_type,
        size_bytes: Some(metadata.len()),
        base64: None,
      });
    }

    let encoded = if include_base64.unwrap_or(true) {
      let bytes = fs::read(&absolute).map_err(|error| error.to_string())?;
      Some(base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        bytes,
      ))
    } else {
      None
    };

    return Ok(FsReadFileResult {
      path: rel,
      content: String::new(),
      total_lines: 0,
      offset: 0,
      limit: 0,
      is_image: Some(true),
      mime_type,
      size_bytes: Some(metadata.len()),
      base64: encoded,
    });
  }

  let content = fs::read_to_string(&absolute).map_err(|error| error.to_string())?;
  let lines: Vec<&str> = content.lines().collect();
  let total_lines = lines.len() as u32;
  let start = (offset.unwrap_or(1).saturating_sub(1) as usize).min(lines.len());
  let max = limit.unwrap_or(total_lines.max(1)) as usize;
  let end = start.saturating_add(max).min(lines.len());
  let slice = lines[start..end].join("\n");

  Ok(FsReadFileResult {
    path: rel,
    content: slice,
    total_lines,
    offset: (start as u32) + 1,
    limit: (end - start) as u32,
    is_image: None,
    mime_type: None,
    size_bytes: None,
    base64: None,
  })
}

#[tauri::command]
pub fn fs_list_dir(project_root: String, path: String) -> Result<Vec<FsDirEntry>, String> {
  let root = canonical_project_root(&project_root)?;
  let absolute = resolve_workspace_path(&project_root, &path)?;
  if !absolute.is_dir() {
    return Err("Path is not a directory".to_string());
  }

  let mut entries = Vec::new();
  for entry in fs::read_dir(&absolute).map_err(|error| error.to_string())? {
    let entry = entry.map_err(|error| error.to_string())?;
    let entry_path = entry.path();
    let name = entry.file_name().to_string_lossy().to_string();
    let rel = relative_path(&root, &entry_path);
    let kind = entry_kind(&entry_path)?;
    entries.push(FsDirEntry { name, path: rel, kind });
  }

  entries.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
  Ok(entries)
}

fn build_tree(root: &Path, dir: &Path, depth: u32, max_depth: u32) -> Result<FsTreeNode, String> {
  let name = dir
    .file_name()
    .map(|value| value.to_string_lossy().to_string())
    .unwrap_or_else(|| ".".to_string());
  let rel = relative_path(root, dir);
  let kind = entry_kind(dir)?;

  let children = if kind == "directory" && depth < max_depth {
    let mut nodes = Vec::new();
    for entry in fs::read_dir(dir).map_err(|error| error.to_string())? {
      let entry = entry.map_err(|error| error.to_string())?;
      nodes.push(build_tree(root, &entry.path(), depth + 1, max_depth)?);
    }
    nodes.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    Some(nodes)
  } else {
    None
  };

  Ok(FsTreeNode {
    name,
    path: rel,
    kind,
    children,
  })
}

#[tauri::command]
pub fn fs_list_dir_tree(
  project_root: String,
  path: String,
  max_depth: Option<u32>,
) -> Result<FsTreeNode, String> {
  let root = canonical_project_root(&project_root)?;
  let absolute = resolve_workspace_path(&project_root, &path)?;
  if !absolute.is_dir() {
    return Err("Path is not a directory".to_string());
  }
  let depth = max_depth.unwrap_or(4);
  build_tree(&root, &absolute, 0, depth)
}

#[tauri::command]
pub fn fs_stat(project_root: String, path: String) -> Result<FsStatResult, String> {
  let root = canonical_project_root(&project_root)?;
  let absolute = resolve_workspace_path(&project_root, &path)?;
  if !absolute.exists() {
    return Ok(FsStatResult {
      path: relative_path(&root, &absolute),
      exists: false,
      kind: "missing".to_string(),
      size: 0,
      modified_ms: None,
    });
  }

  let meta = fs::metadata(&absolute).map_err(|error| error.to_string())?;
  Ok(FsStatResult {
    path: relative_path(&root, &absolute),
    exists: true,
    kind: entry_kind(&absolute)?,
    size: meta.len(),
    modified_ms: modified_ms(&absolute),
  })
}

#[tauri::command]
pub fn fs_write_file(project_root: String, path: String, content: String) -> Result<FileDiff, String> {
  let root = canonical_project_root(&project_root)?;
  let absolute = resolve_workspace_path(&project_root, &path)?;
  let old_content = if absolute.exists() {
    Some(fs::read_to_string(&absolute).map_err(|error| error.to_string())?)
  } else {
    None
  };
  if let Some(parent) = absolute.parent() {
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
  }
  fs::write(&absolute, &content).map_err(|error| error.to_string())?;
  let operation = if old_content.is_some() {
    "update"
  } else {
    "create"
  };
  Ok(build_file_diff(
    relative_path(&root, &absolute),
    operation,
    old_content,
    Some(content),
  ))
}

#[tauri::command]
pub fn fs_edit_file(
  project_root: String,
  path: String,
  replacements: Vec<FsEditReplacement>,
) -> Result<FileDiff, String> {
  if replacements.is_empty() {
    return Err("At least one replacement is required".to_string());
  }
  let root = canonical_project_root(&project_root)?;
  let absolute = resolve_workspace_path(&project_root, &path)?;
  let old_content = fs::read_to_string(&absolute).map_err(|error| error.to_string())?;
  let new_content = apply_replacements(&old_content, &replacements)?;
  fs::write(&absolute, &new_content).map_err(|error| error.to_string())?;
  Ok(build_file_diff(
    relative_path(&root, &absolute),
    "update",
    Some(old_content),
    Some(new_content),
  ))
}

#[tauri::command]
pub fn fs_apply_patch(project_root: String, patch: String) -> Result<Vec<FileDiff>, String> {
  apply_patch_operations(&project_root, &patch)
}

fn copy_recursive(from: &Path, to: &Path) -> Result<(), String> {
  if from.is_dir() {
    fs::create_dir_all(to).map_err(|error| error.to_string())?;
    for entry in fs::read_dir(from).map_err(|error| error.to_string())? {
      let entry = entry.map_err(|error| error.to_string())?;
      copy_recursive(&entry.path(), &to.join(entry.file_name()))?;
    }
    Ok(())
  } else {
    if let Some(parent) = to.parent() {
      fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::copy(from, to).map_err(|error| error.to_string())?;
    Ok(())
  }
}

fn resolve_copy_destination(from: &Path, to: &Path) -> PathBuf {
  if to.exists() && to.is_dir() {
    let file_name = from
      .file_name()
      .map(|value| value.to_owned())
      .unwrap_or_default();
    to.join(file_name)
  } else {
    to.to_path_buf()
  }
}

#[tauri::command]
pub fn fs_rename(project_root: String, from: String, to: String) -> Result<(), String> {
  let absolute_from = resolve_workspace_path(&project_root, &from)?;
  let absolute_to = resolve_workspace_path(&project_root, &to)?;
  if !absolute_from.exists() {
    return Err("Source path does not exist".to_string());
  }
  if absolute_to.exists() {
    return Err("Destination already exists".to_string());
  }
  if let Some(parent) = absolute_to.parent() {
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
  }
  fs::rename(&absolute_from, &absolute_to).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn fs_delete(
  project_root: String,
  path: String,
  recursive: Option<bool>,
) -> Result<(), String> {
  let absolute = resolve_workspace_path(&project_root, &path)?;
  if !absolute.exists() {
    return Err("Path does not exist".to_string());
  }

  let meta = fs::symlink_metadata(&absolute).map_err(|error| error.to_string())?;
  if meta.is_dir() {
    if recursive.unwrap_or(false) {
      fs::remove_dir_all(&absolute).map_err(|error| error.to_string())
    } else {
      fs::remove_dir(&absolute).map_err(|error| error.to_string())
    }
  } else {
    fs::remove_file(&absolute).map_err(|error| error.to_string())
  }
}

#[tauri::command]
pub fn fs_copy(project_root: String, from: String, to: String) -> Result<(), String> {
  let absolute_from = resolve_workspace_path(&project_root, &from)?;
  let absolute_to = resolve_workspace_path(&project_root, &to)?;
  if !absolute_from.exists() {
    return Err("Source path does not exist".to_string());
  }

  let destination = resolve_copy_destination(&absolute_from, &absolute_to);
  if destination.exists() {
    return Err("Destination already exists".to_string());
  }

  copy_recursive(&absolute_from, &destination)
}

#[tauri::command]
pub fn fs_move(project_root: String, from: String, to: String) -> Result<(), String> {
  let absolute_from = resolve_workspace_path(&project_root, &from)?;
  let absolute_to = resolve_workspace_path(&project_root, &to)?;
  if !absolute_from.exists() {
    return Err("Source path does not exist".to_string());
  }

  let destination = resolve_copy_destination(&absolute_from, &absolute_to);
  if destination.exists() {
    return Err("Destination already exists".to_string());
  }
  if let Some(parent) = destination.parent() {
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
  }

  match fs::rename(&absolute_from, &destination) {
    Ok(()) => Ok(()),
    Err(_) => {
      copy_recursive(&absolute_from, &destination)?;
      if absolute_from.is_dir() {
        fs::remove_dir_all(&absolute_from).map_err(|error| error.to_string())?;
      } else {
        fs::remove_file(&absolute_from).map_err(|error| error.to_string())?;
      }
      Ok(())
    }
  }
}

#[tauri::command]
pub fn fs_mkdir(project_root: String, path: String) -> Result<(), String> {
  let absolute = resolve_workspace_path(&project_root, &path)?;
  fs::create_dir_all(&absolute).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn fs_stage_preview(
  project_root: String,
  request: FsStagePreviewRequest,
) -> Result<Vec<FileDiff>, String> {
  let root = canonical_project_root(&project_root)?;
  match request {
    FsStagePreviewRequest::Write { path, content } => {
      let absolute = resolve_workspace_path(&project_root, &path)?;
      let old_content = if absolute.exists() {
        Some(fs::read_to_string(&absolute).map_err(|error| error.to_string())?)
      } else {
        None
      };
      let operation = if old_content.is_some() { "update" } else { "create" };
      Ok(vec![build_file_diff(
        relative_path(&root, &absolute),
        operation,
        old_content,
        Some(content),
      )])
    }
    FsStagePreviewRequest::Edit { path, replacements } => {
      if replacements.is_empty() {
        return Err("At least one replacement is required".to_string());
      }
      let absolute = resolve_workspace_path(&project_root, &path)?;
      let old_content = fs::read_to_string(&absolute).map_err(|error| error.to_string())?;
      let new_content = apply_replacements(&old_content, &replacements)?;
      Ok(vec![build_file_diff(
        relative_path(&root, &absolute),
        "update",
        Some(old_content),
        Some(new_content),
      )])
    }
    FsStagePreviewRequest::ApplyPatch { patch } => preview_patch(&project_root, &patch),
    FsStagePreviewRequest::Delete { path } => {
      let absolute = resolve_workspace_path(&project_root, &path)?;
      let old_content = fs::read_to_string(&absolute).map_err(|error| error.to_string())?;
      Ok(vec![build_file_diff(
        relative_path(&root, &absolute),
        "delete",
        Some(old_content),
        None,
      )])
    }
  }
}
