use std::process::Command;

use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRepoInfo {
  pub is_repo: bool,
  pub current_branch: Option<String>,
}

fn run_git(root_path: &str, args: &[&str]) -> Result<String, String> {
  let output = Command::new("git")
    .arg("-C")
    .arg(root_path)
    .args(args)
    .output()
    .map_err(|error| format!("Failed to run git: {error}"))?;

  if output.status.success() {
    return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
  }

  let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
  if stderr.is_empty() {
    Err(format!("git {} failed with status {}", args.join(" "), output.status))
  } else {
    Err(stderr)
  }
}

fn is_git_repo(root_path: &str) -> bool {
  run_git(root_path, &["rev-parse", "--is-inside-work-tree"])
    .map(|value| value == "true")
    .unwrap_or(false)
}

#[tauri::command]
pub fn git_repo_info(root_path: String) -> Result<GitRepoInfo, String> {
  if !is_git_repo(&root_path) {
    return Ok(GitRepoInfo {
      is_repo: false,
      current_branch: None,
    });
  }

  let current_branch = run_git(&root_path, &["branch", "--show-current"])
    .ok()
    .filter(|branch| !branch.is_empty());

  Ok(GitRepoInfo {
    is_repo: true,
    current_branch,
  })
}

#[tauri::command]
pub fn git_list_branches(root_path: String) -> Result<Vec<String>, String> {
  if !is_git_repo(&root_path) {
    return Ok(vec![]);
  }

  let output = run_git(
    &root_path,
    &["branch", "--format=%(refname:short)"],
  )?;

  let mut branches: Vec<String> = output
    .lines()
    .map(str::trim)
    .filter(|branch| !branch.is_empty())
    .map(str::to_string)
    .collect();

  branches.sort_by(|left, right| left.to_lowercase().cmp(&right.to_lowercase()));
  branches.dedup();

  Ok(branches)
}

#[tauri::command]
pub fn git_checkout_branch(root_path: String, branch: String) -> Result<(), String> {
  if branch.trim().is_empty() {
    return Err("Branch name is required".to_string());
  }

  if !is_git_repo(&root_path) {
    return Err("Not a git repository".to_string());
  }

  run_git(&root_path, &["checkout", branch.trim()])?;
  Ok(())
}
