mod commands;

use commands::{
  config_exists, delete_secret, get_active_project, get_default_workspace_root, get_secret,
  get_user_pyrola_dir, get_pyrola_dir, git_checkout_branch, git_list_branches, git_repo_info,
  has_project_pyrola, http_proxy_request, list_project_files,
  list_pyrola_files,
  mcp_list_tools, mcp_logout,
  mcp_refresh, mcp_start, mcp_status, mcp_stop, read_json_file, read_mcp_config, read_settings,
  registry_add_project, registry_list_projects, registry_remove_project, registry_set_active_project,
  reveal_in_folder, set_secret, watch_pyrola_paths, write_json_file, write_mcp_config, write_settings,
  WatchState,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .manage(WatchState::new())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      #[cfg(target_os = "macos")]
      {
        use tauri::Manager;
        if let Some(window) = app.get_webview_window("main") {
          hide_macos_traffic_lights(&window);
          apply_platform_vibrancy(&window, false);
        }
      }

      #[cfg(target_os = "windows")]
      {
        use tauri::Manager;
        if let Some(window) = app.get_webview_window("main") {
          apply_platform_vibrancy(&window, false);
        }
      }

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      set_vibrancy_dark,
      set_vibrancy_light,
      clear_vibrancy,
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
      get_active_project,
      get_secret,
      set_secret,
      delete_secret,
      http_proxy_request,
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

#[cfg(target_os = "macos")]
fn apply_platform_vibrancy(window: &tauri::WebviewWindow, dark: bool) {
  use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

  let material = if dark {
    NSVisualEffectMaterial::UnderWindowBackground
  } else {
    NSVisualEffectMaterial::HudWindow
  };

  if let Err(err) = apply_vibrancy(window, material, None, None) {
    log::warn!("failed to apply macOS vibrancy: {err}");
  }
}

#[cfg(target_os = "windows")]
fn apply_platform_vibrancy(window: &tauri::WebviewWindow, dark: bool) {
  use window_vibrancy::{apply_acrylic, apply_mica};

  if apply_mica(window, Some(dark)).is_err() {
    let color = if dark {
      Some((18, 18, 18, 125))
    } else {
      Some((240, 240, 240, 125))
    };
    if let Err(err) = apply_acrylic(window, color) {
      log::warn!("failed to apply Windows vibrancy: {err}");
    }
  }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn apply_platform_vibrancy(_window: &tauri::WebviewWindow, _dark: bool) {}

fn clear_platform_vibrancy(window: &tauri::WebviewWindow) {
  #[cfg(target_os = "macos")]
  {
    if let Err(err) = window_vibrancy::clear_vibrancy(window) {
      log::warn!("failed to clear macOS vibrancy: {err}");
    }
  }

  #[cfg(target_os = "windows")]
  {
    let _ = window_vibrancy::clear_mica(window);
    let _ = window_vibrancy::clear_acrylic(window);
  }
}

#[tauri::command]
fn set_vibrancy_dark(window: tauri::WebviewWindow) {
  clear_platform_vibrancy(&window);
  apply_platform_vibrancy(&window, true);
}

#[tauri::command]
fn set_vibrancy_light(window: tauri::WebviewWindow) {
  clear_platform_vibrancy(&window);
  apply_platform_vibrancy(&window, false);
}

#[tauri::command]
fn clear_vibrancy(window: tauri::WebviewWindow) {
  clear_platform_vibrancy(&window);
}
