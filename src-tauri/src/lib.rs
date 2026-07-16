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
        }
      }

      Ok(())
    })
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
