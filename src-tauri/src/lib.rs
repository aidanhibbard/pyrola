#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
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
      clear_vibrancy
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[cfg(target_os = "macos")]
fn hide_macos_traffic_lights(window: &tauri::WebviewWindow) {
  use objc2_app_kit::{NSWindow, NSWindowButton};

  let Ok(ns_window_ptr) = window.ns_window() else { return };
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

/// Applies the platform-appropriate vibrancy/glass effect to the given window.
///
/// - macOS: uses `NSVisualEffectMaterial` vibrancy (works on macOS 10.10+).
///   Liquid Glass (macOS 26+) is not yet available in the published
///   `window-vibrancy` crate, so this falls back to classic vibrancy on all
///   macOS versions for now.
/// - Windows: uses Mica on Windows 11, falling back to Acrylic when Mica is
///   unsupported (e.g. Windows 10).
/// - Linux: unsupported by `window-vibrancy`; the frontend applies a CSS
///   `backdrop-filter` fallback instead.
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
fn apply_platform_vibrancy(_window: &tauri::WebviewWindow, _dark: bool) {
  // Linux vibrancy is compositor-controlled; handled via CSS on the frontend.
}

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
