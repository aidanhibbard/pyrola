use std::path::{Component, Path, PathBuf};

pub fn resolve_workspace_path(project_root: &str, relative_path: &str) -> Result<PathBuf, String> {
  let root = PathBuf::from(project_root)
    .canonicalize()
    .map_err(|e| format!("Invalid project root: {e}"))?;

  let relative = Path::new(relative_path);
  if relative.is_absolute() {
    return Err("Absolute paths are not allowed".to_string());
  }

  for component in relative.components() {
    if matches!(component, Component::ParentDir) {
      return Err("Path traversal is not allowed".to_string());
    }
  }

  let joined = root.join(relative);
  let canonical = joined
    .canonicalize()
    .map_err(|e| format!("Path not found: {e}"))?;

  if !canonical.starts_with(&root) {
    return Err("Path escapes project root".to_string());
  }

  Ok(canonical)
}
