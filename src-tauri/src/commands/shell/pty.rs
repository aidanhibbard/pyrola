use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use super::super::fs::resolve_workspace_path;
use super::super::paths::user_pyrola_dir;

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


lazy_static::lazy_static! {
  static ref PTY_SESSIONS: Mutex<HashMap<String, Arc<Mutex<PtySession>>>> =
    Mutex::new(HashMap::new());
}

#[tauri::command]
pub fn reveal_in_folder(app: AppHandle, path: String) -> Result<(), String> {
  let canonical = PathBuf::from(&path)
    .canonicalize()
    .map_err(|error| format!("Path does not exist or cannot be resolved: {error}"))?;

  let home = std::env::var("HOME")
    .or_else(|_| std::env::var("USERPROFILE"))
    .ok()
    .map(PathBuf::from)
    .and_then(|home| home.canonicalize().ok().or(Some(home)));

  let user_pyrola = user_pyrola_dir(&app)?;
  let user_pyrola_canon = user_pyrola
    .canonicalize()
    .unwrap_or_else(|_| user_pyrola.clone());

  let under_home = home
    .as_ref()
    .is_some_and(|home_path| canonical.starts_with(home_path));
  let under_pyrola = canonical.starts_with(&user_pyrola_canon);

  if !under_home && !under_pyrola {
    return Err("Path is outside allowed directories".to_string());
  }

  open::that_detached(canonical).map_err(|e| e.to_string())
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
