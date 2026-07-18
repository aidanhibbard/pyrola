use std::collections::HashMap;
use std::io::{Read, Write};
use std::process::Stdio;
use std::sync::{Arc, Mutex};

use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncReadExt;
use tokio::process::Command;
use tokio::time::{timeout, Duration};
use uuid::Uuid;

use super::fs::resolve_workspace_path;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PtySessionInfo {
  pub session_id: String,
}

struct PtySession {
  master: Box<dyn portable_pty::MasterPty + Send>,
  writer: Box<dyn Write + Send>,
  child: Box<dyn portable_pty::Child + Send>,
}

struct TrackedShell {
  child: tokio::process::Child,
}

lazy_static::lazy_static! {
  static ref PTY_SESSIONS: Mutex<HashMap<String, Arc<Mutex<PtySession>>>> =
    Mutex::new(HashMap::new());
  static ref TRACKED_SHELLS: Mutex<HashMap<String, TrackedShell>> =
    Mutex::new(HashMap::new());
}

#[tauri::command]
pub fn reveal_in_folder(path: String) -> Result<(), String> {
  open::that_detached(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn shell_spawn_pty(
  app: AppHandle,
  project_root: String,
  cols: u16,
  rows: u16,
  cwd: Option<String>,
) -> Result<PtySessionInfo, String> {
  let pty_system = native_pty_system();
  let pair = pty_system
    .openpty(PtySize {
      rows,
      cols,
      pixel_width: 0,
      pixel_height: 0,
    })
    .map_err(|e| e.to_string())?;

  let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
  let mut cmd = CommandBuilder::new(shell);
  let work_dir = match cwd {
    Some(relative_cwd) => resolve_workspace_path(&project_root, &relative_cwd)?
      .to_string_lossy()
      .to_string(),
    None => project_root,
  };
  cmd.cwd(work_dir);
  cmd.env("TERM", "xterm-256color");

  let child = pair
    .slave
    .spawn_command(cmd)
    .map_err(|e| e.to_string())?;

  let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
  let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

  let session_id = Uuid::new_v4().to_string();
  let event_name = format!("pty-output-{session_id}");
  let app_handle = app.clone();
  let sid = session_id.clone();

  std::thread::spawn(move || {
    let mut buffer = [0u8; 4096];
    loop {
      match reader.read(&mut buffer) {
        Ok(0) => break,
        Ok(count) => {
          let data = String::from_utf8_lossy(&buffer[..count]).to_string();
          let _ = app_handle.emit(&event_name, data);
        }
        Err(_) => break,
      }
    }
    let _ = app_handle.emit(
      &format!("pty-exit-{sid}"),
      serde_json::json!({ "sessionId": sid }),
    );
  });

  PTY_SESSIONS.lock().unwrap().insert(
    session_id.clone(),
    Arc::new(Mutex::new(PtySession {
      master: pair.master,
      writer,
      child,
    })),
  );

  Ok(PtySessionInfo { session_id })
}

#[tauri::command]
pub fn shell_write_pty(session_id: String, data: String) -> Result<(), String> {
  let sessions = PTY_SESSIONS.lock().unwrap();
  let session = sessions
    .get(&session_id)
    .ok_or_else(|| "PTY session not found".to_string())?;
  let mut guard = session.lock().unwrap();
  guard
    .writer
    .write_all(data.as_bytes())
    .map_err(|e| e.to_string())?;
  guard.writer.flush().map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
pub fn shell_resize_pty(session_id: String, cols: u16, rows: u16) -> Result<(), String> {
  let sessions = PTY_SESSIONS.lock().unwrap();
  let session = sessions
    .get(&session_id)
    .ok_or_else(|| "PTY session not found".to_string())?;
  let guard = session.lock().unwrap();
  guard
    .master
    .resize(PtySize {
      rows,
      cols,
      pixel_width: 0,
      pixel_height: 0,
    })
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn shell_kill_pty(session_id: String) -> Result<(), String> {
  let session = PTY_SESSIONS.lock().unwrap().remove(&session_id);
  if let Some(session) = session {
    let mut guard = session.lock().unwrap();
    let _ = guard.child.kill();
  }
  Ok(())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellRunResult {
  pub stdout: String,
  pub stderr: String,
  pub exit_code: i32,
  pub timed_out: bool,
}

#[tauri::command]
pub async fn shell_run_command(
  project_root: String,
  command: String,
  timeout_ms: Option<u64>,
) -> Result<ShellRunResult, String> {
  let limit = Duration::from_millis(timeout_ms.unwrap_or(30_000));

  let child = Command::new("sh")
    .arg("-c")
    .arg(&command)
    .current_dir(&project_root)
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .kill_on_drop(true)
    .spawn()
    .map_err(|e| e.to_string())?;

  match timeout(limit, child.wait_with_output()).await {
    Ok(Ok(output)) => Ok(ShellRunResult {
      stdout: String::from_utf8_lossy(&output.stdout).to_string(),
      stderr: String::from_utf8_lossy(&output.stderr).to_string(),
      exit_code: output.status.code().unwrap_or(-1),
      timed_out: false,
    }),
    Ok(Err(error)) => Err(error.to_string()),
    Err(_) => Ok(ShellRunResult {
      stdout: String::new(),
      stderr: format!("Command timed out after {}ms", limit.as_millis()),
      exit_code: -1,
      timed_out: true,
    }),
  }
}

#[cfg(unix)]
fn kill_process_group(child: &mut tokio::process::Child) {
  if let Some(pid) = child.id() {
    unsafe {
      libc::killpg(pid as i32, libc::SIGTERM);
    }
  }
}

async fn pump_shell_stream(
  app: AppHandle,
  shell_id: String,
  stream: &'static str,
  mut reader: impl AsyncReadExt + Unpin,
) {
  let event_name = format!("shell-output-{shell_id}");
  let mut buffer = [0u8; 4096];

  loop {
    match reader.read(&mut buffer).await {
      Ok(0) => break,
      Ok(count) => {
        let data = String::from_utf8_lossy(&buffer[..count]).to_string();
        let _ = app.emit(
          &event_name,
          serde_json::json!({
            "shellId": shell_id,
            "stream": stream,
            "data": data,
          }),
        );
      }
      Err(_) => break,
    }
  }
}

fn build_tracked_command(project_root: &str, command: &str) -> Command {
  let mut cmd = Command::new("sh");
  cmd
    .arg("-c")
    .arg(command)
    .current_dir(project_root)
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .kill_on_drop(true);

  #[cfg(unix)]
  unsafe {
    cmd.pre_exec(|| {
      libc::setpgid(0, 0);
      Ok(())
    });
  }

  cmd
}

#[tauri::command]
pub async fn shell_spawn_tracked(
  app: AppHandle,
  shell_id: String,
  project_root: String,
  command: String,
) -> Result<(), String> {
  let mut child = build_tracked_command(&project_root, &command)
    .spawn()
    .map_err(|e| e.to_string())?;

  let stdout = child
    .stdout
    .take()
    .ok_or_else(|| "stdout unavailable".to_string())?;
  let stderr = child
    .stderr
    .take()
    .ok_or_else(|| "stderr unavailable".to_string())?;

  TRACKED_SHELLS
    .lock()
    .unwrap()
    .insert(shell_id.clone(), TrackedShell { child });

  let app_stdout = app.clone();
  let shell_stdout = shell_id.clone();
  tokio::spawn(async move {
    pump_shell_stream(app_stdout, shell_stdout, "stdout", stdout).await;
  });

  let app_stderr = app.clone();
  let shell_stderr = shell_id.clone();
  tokio::spawn(async move {
    pump_shell_stream(app_stderr, shell_stderr, "stderr", stderr).await;
  });

  let app_wait = app.clone();
  let shell_wait = shell_id.clone();
  tokio::spawn(async move {
    let child_opt = TRACKED_SHELLS.lock().unwrap().remove(&shell_wait);
    let exit_code = match child_opt {
      Some(mut tracked) => match tracked.child.wait().await {
        Ok(status) => status.code().unwrap_or(-1),
        Err(_) => -1,
      },
      None => return,
    };

    let _ = app_wait.emit(
      &format!("shell-exit-{shell_wait}"),
      serde_json::json!({
        "shellId": shell_wait,
        "exitCode": exit_code,
      }),
    );
  });

  Ok(())
}

#[tauri::command]
pub async fn shell_kill_tracked(shell_id: String) -> Result<i32, String> {
  let child_opt = TRACKED_SHELLS.lock().unwrap().remove(&shell_id);

  let Some(mut tracked) = child_opt else {
    return Err("Shell not found".to_string());
  };

  #[cfg(unix)]
  kill_process_group(&mut tracked.child);

  let _ = tracked.child.start_kill();
  let status = tracked
    .child
    .wait()
    .await
    .map_err(|error| error.to_string())?;

  Ok(status.code().unwrap_or(-1))
}
