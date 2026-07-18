mod commands;
mod tray;

use tauri::Manager;

use commands::{
  append_chat_line, config_exists, create_chat, delete_chat, delete_secret, fork_chat,
  truncate_chat_log,
  fs_apply_patch, fs_edit_file, fs_list_dir, fs_list_dir_tree, fs_read_file, fs_stage_preview,
  fs_stat, fs_write_file, get_active_project, get_default_workspace_root, get_secret,
  get_user_pyrola_dir, get_pyrola_dir, git_checkout_branch, git_diff, git_list_branches,
  git_log, git_repo_info, git_status, has_project_pyrola, http_proxy_request, http_proxy_stream,
  list_chats,
  list_pinned_chats, list_project_files, list_pyrola_files, lsp_ensure_server, lsp_request,
  lsp_status, lsp_stop_server, mcp_call_tool, mcp_list_tools,
  mcp_logout, mcp_refresh, mcp_start, mcp_status, mcp_stop, pin_chat, read_chat_meta,
  read_chat_messages, read_json_file, read_mcp_config, read_settings, registry_add_project,
  open_project_at_path, registry_list_projects, registry_remove_project,
  registry_set_active_project, registry_update_project_root, resolve_launch_path, reveal_in_folder,
  set_secret, shell_kill_pty, shell_kill_tracked, shell_resize_pty, shell_run_command,
  shell_spawn_pty, shell_spawn_tracked, shell_write_pty, update_chat_meta,
  watch_pyrola_paths, workspace_glob, workspace_grep, write_json_file, write_mcp_config,
  write_settings, WatchState,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  run_with_launch_path(None);
}

pub fn run_with_launch_path(launch_path: Option<String>) {
  let builder = tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init());

  #[cfg(debug_assertions)]
  let builder = builder.plugin(tauri_plugin_mcp_bridge::init());

  builder
    .manage(WatchState::new())
    .setup(move |app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      if let Some(path_arg) = launch_path.as_deref() {
        match resolve_launch_path(path_arg) {
          Ok(path) => {
            if let Err(error) = open_project_at_path(&app.handle(), path) {
              log::error!("Failed to open CLI project: {error}");
            }
          }
          Err(error) => log::error!("Invalid CLI path: {error}"),
        }
      }

      #[cfg(target_os = "macos")]
      {
        use tauri::Manager;
        if let Some(window) = app.get_webview_window("main") {
          hide_macos_traffic_lights(&window);
        }
      }

      tray::setup(app.handle())?;

      Ok(())
    })
    .on_window_event(|window, event| {
      if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        if crate::commands::config::tray_background_enabled(window.app_handle()) {
          api.prevent_close();
          tray::handle_close_requested(window);
        }
      }
    })
    .invoke_handler(tauri::generate_handler![
      get_user_pyrola_dir,
      get_default_workspace_root,
      has_project_pyrola,
      read_settings,
      write_settings,
      read_mcp_config,
      write_mcp_config,
      read_json_file,
      write_json_file,
      config_exists,
  registry_list_projects,
  registry_add_project,
  registry_remove_project,
  registry_set_active_project,
  registry_update_project_root,
  get_active_project,
      get_secret,
      set_secret,
      delete_secret,
      http_proxy_request,
      http_proxy_stream,
      reveal_in_folder,
      git_repo_info,
      git_list_branches,
      git_checkout_branch,
      get_pyrola_dir,
      list_project_files,
      list_pyrola_files,
      mcp_start,
      mcp_stop,
      mcp_refresh,
      mcp_logout,
      mcp_list_tools,
      mcp_status,
      watch_pyrola_paths,
      create_chat,
      list_chats,
      read_chat_meta,
      read_chat_messages,
      append_chat_line,
      truncate_chat_log,
      update_chat_meta,
      delete_chat,
      fork_chat,
      pin_chat,
      list_pinned_chats,
      mcp_call_tool,
      shell_spawn_pty,
      shell_write_pty,
      shell_resize_pty,
      shell_kill_pty,
      shell_run_command,
      shell_spawn_tracked,
      shell_kill_tracked,
      fs_read_file,
      fs_write_file,
      fs_edit_file,
      fs_apply_patch,
      fs_list_dir,
      fs_list_dir_tree,
      fs_stat,
      fs_stage_preview,
      workspace_grep,
      workspace_glob,
      git_status,
      git_diff,
      git_log,
      lsp_status,
      lsp_request,
      lsp_ensure_server,
      lsp_stop_server,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[cfg(target_os = "macos")]
fn hide_macos_traffic_lights(window: &tauri::WebviewWindow) {
  use objc2_app_kit::{NSWindow, NSWindowButton};

  let Ok(ns_window_ptr) = window.ns_window() else {
    return;
  };
  let ns_window: &NSWindow = unsafe { &*(ns_window_ptr as *const NSWindow) };

  for btn in [
    NSWindowButton::CloseButton,
    NSWindowButton::MiniaturizeButton,
    NSWindowButton::ZoomButton,
  ] {
    if let Some(button) = ns_window.standardWindowButton(btn) {
      button.setHidden(true);
    }
  }
}
