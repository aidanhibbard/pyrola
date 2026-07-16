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

use tokio::process::Command as AsyncCommand;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusEntry {
  pub path: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub old_path: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub staged_status: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub unstaged_status: Option<String>,
  pub is_untracked: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusResult {
  pub branch: Option<String>,
  pub entries: Vec<GitStatusEntry>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitDiffResult {
  pub diff: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLogEntry {
  pub hash: String,
  pub subject: String,
  pub author: String,
  pub date: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLogResult {
  pub commits: Vec<GitLogEntry>,
}

async fn run_git_async(root_path: &str, args: &[&str]) -> Result<String, String> {
  let output = AsyncCommand::new("git")
    .arg("-C")
    .arg(root_path)
    .args(args)
    .output()
    .await
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

fn parse_status_code(code: char) -> Option<String> {
  if code == ' ' {
    return None;
  }
  Some(code.to_string())
}

fn parse_porcelain_status(line: &str) -> Option<GitStatusEntry> {
  if line.len() < 4 {
    return None;
  }
  let x = line.chars().next()?;
  let y = line.chars().nth(1)?;
  if x == '?' && y == '?' {
    let path = line[3..].trim().to_string();
    return Some(GitStatusEntry {
      path,
      old_path: None,
      staged_status: None,
      unstaged_status: Some("?".to_string()),
      is_untracked: true,
    });
  }

  let rest = line[3..].trim();
  let (path, old_path) = if let Some((left, right)) = rest.split_once(" -> ") {
    (right.trim().to_string(), Some(left.trim().to_string()))
  } else {
    (rest.to_string(), None)
  };

  Some(GitStatusEntry {
    path,
    old_path,
    staged_status: parse_status_code(x),
    unstaged_status: parse_status_code(y),
    is_untracked: false,
  })
}

#[tauri::command]
pub async fn git_status(project_root: String) -> Result<GitStatusResult, String> {
  if !is_git_repo(&project_root) {
    return Err("Not a git repository".to_string());
  }

  let branch = run_git_async(&project_root, &["branch", "--show-current"])
    .await
    .ok()
    .filter(|value| !value.is_empty());

  let output = run_git_async(&project_root, &["status", "--porcelain=1"]).await?;
  let entries = output
    .lines()
    .filter_map(parse_porcelain_status)
    .collect();

  Ok(GitStatusResult { branch, entries })
}

#[tauri::command]
pub async fn git_diff(
  project_root: String,
  path: Option<String>,
  staged: Option<bool>,
) -> Result<GitDiffResult, String> {
  if !is_git_repo(&project_root) {
    return Err("Not a git repository".to_string());
  }

  let mut args = vec!["diff"];
  if staged.unwrap_or(false) {
    args.push("--cached");
  }
  if let Some(file_path) = path.as_deref().filter(|value| !value.trim().is_empty()) {
    args.push("--");
    args.push(file_path.trim());
  }

  let diff = run_git_async(&project_root, &args).await?;
  Ok(GitDiffResult { diff })
}

#[tauri::command]
pub async fn git_log(project_root: String, limit: Option<u32>) -> Result<GitLogResult, String> {
  if !is_git_repo(&project_root) {
    return Err("Not a git repository".to_string());
  }

  let count_arg = format!("-{}", limit.unwrap_or(20).max(1));
  let pretty_arg = "--pretty=format:%H%x1f%s%x1f%an%x1f%aI".to_string();
  let output = run_git_async(
    &project_root,
    &["log", &count_arg, &pretty_arg],
  )
  .await?;

  let commits = output
    .lines()
    .filter(|line| !line.trim().is_empty())
    .filter_map(|line| {
      let mut parts = line.split('\x1f');
      let hash = parts.next()?.to_string();
      let subject = parts.next()?.to_string();
      let author = parts.next()?.to_string();
      let date = parts.next()?.to_string();
      Some(GitLogEntry {
        hash,
        subject,
        author,
        date,
      })
    })
    .collect();

  Ok(GitLogResult { commits })
}
