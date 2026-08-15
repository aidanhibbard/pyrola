//! Embedded CEF browser commands (feature-gated, `cef` cargo feature).
//!
//! Navigation (back/forward/reload/can_go_*) uses the CEF BrowserHost API.
//! CDP is shared on one DevTools port; `browser_cef_get_cdp_ws_url` returns the
//! page-target WebSocket URL for that session (see runtime module docs).
//! `browser_cef_eval` is deferred: CEF `execute_java_script` does not return a
//! value; use CDP `Runtime.evaluate` against the session WS URL instead.

#[path = "browser-cef-runtime.rs"]
mod runtime;

use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::Window;

pub use runtime::{
  cdp_endpoint, create_browser_for_spike, destroy_browser_for_spike, pump_on_main_thread,
  warm_init, warm_init_dev, CefBounds,
};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserCefBenchResult {
  pub iterations: u32,
  pub create_ms: Vec<f64>,
  pub destroy_ms: Vec<f64>,
  pub avg_create_ms: f64,
  pub avg_destroy_ms: f64,
}

fn run_on_window_main<T, F>(window: &Window, work: F) -> Result<T, String>
where
  T: Send + 'static,
  F: FnOnce() -> Result<T, String> + Send + 'static,
{
  let (tx, rx) = std::sync::mpsc::channel();
  window
    .run_on_main_thread(move || {
      let _ = tx.send(work());
    })
    .map_err(|e| e.to_string())?;
  rx.recv_timeout(Duration::from_secs(30))
    .map_err(|e| format!("main-thread CEF work timed out: {e}"))?
}

#[tauri::command]
pub async fn browser_cef_create(window: Window, bounds: CefBounds) -> Result<String, String> {
  let window_for_work = window.clone();
  run_on_window_main(&window, move || {
    runtime::create_browser_on_main(&window_for_work, bounds)
  })
}

#[tauri::command]
pub async fn browser_cef_destroy(window: Window, session_id: String) -> Result<(), String> {
  run_on_window_main(&window, move || runtime::destroy_browser_on_main(&session_id))
}

#[tauri::command]
pub async fn browser_cef_navigate(
  window: Window,
  session_id: String,
  url: String,
) -> Result<(), String> {
  run_on_window_main(&window, move || {
    runtime::navigate_browser_on_main(&session_id, &url)
  })
}

#[tauri::command]
pub async fn browser_cef_resize(
  window: Window,
  session_id: String,
  bounds: CefBounds,
) -> Result<(), String> {
  let window_for_work = window.clone();
  run_on_window_main(&window, move || {
    runtime::resize_browser_on_main(&window_for_work, &session_id, bounds)
  })
}

/// Publish CSS-space hole rects so native hit-testing can pass clicks to CEF.
/// Empty `rects` clears pass-through (WKWebView keeps all hits again).
#[tauri::command]
pub async fn browser_cef_set_passthrough_rects(
  window: Window,
  rects: Vec<CefBounds>,
) -> Result<(), String> {
  let window_for_work = window.clone();
  run_on_window_main(&window, move || {
    runtime::set_passthrough_rects_on_main(&window_for_work, rects)
  })
}

#[tauri::command]
pub async fn browser_cef_focus(window: Window, session_id: String) -> Result<(), String> {
  run_on_window_main(&window, move || runtime::focus_browser_on_main(&session_id))
}

#[tauri::command]
pub async fn browser_cef_get_url(window: Window, session_id: String) -> Result<String, String> {
  run_on_window_main(&window, move || runtime::get_url_on_main(&session_id))
}

#[tauri::command]
pub async fn browser_cef_get_title(window: Window, session_id: String) -> Result<String, String> {
  run_on_window_main(&window, move || runtime::get_title_on_main(&session_id))
}

#[tauri::command]
pub async fn browser_cef_can_go_back(
  window: Window,
  session_id: String,
) -> Result<bool, String> {
  run_on_window_main(&window, move || runtime::can_go_back_on_main(&session_id))
}

#[tauri::command]
pub async fn browser_cef_can_go_forward(
  window: Window,
  session_id: String,
) -> Result<bool, String> {
  run_on_window_main(&window, move || runtime::can_go_forward_on_main(&session_id))
}

#[tauri::command]
pub async fn browser_cef_go_back(window: Window, session_id: String) -> Result<(), String> {
  run_on_window_main(&window, move || runtime::go_back_on_main(&session_id))
}

#[tauri::command]
pub async fn browser_cef_go_forward(window: Window, session_id: String) -> Result<(), String> {
  run_on_window_main(&window, move || runtime::go_forward_on_main(&session_id))
}

#[tauri::command]
pub async fn browser_cef_reload(window: Window, session_id: String) -> Result<(), String> {
  run_on_window_main(&window, move || runtime::reload_on_main(&session_id))
}

#[tauri::command]
pub async fn browser_cef_get_cdp_ws_url(session_id: String) -> Result<String, String> {
  runtime::get_cdp_ws_url_on_main(&session_id)
}

#[tauri::command]
pub async fn browser_cef_last_warm_init_error() -> Result<Option<String>, String> {
  Ok(runtime::last_warm_init_error())
}

#[tauri::command]
pub async fn browser_cef_cdp_endpoint() -> Result<String, String> {
  runtime::ensure_ready()?;
  Ok(cdp_endpoint())
}

#[tauri::command]
pub async fn browser_cef_bench(
  window: Window,
  iterations: u32,
) -> Result<BrowserCefBenchResult, String> {
  let n = iterations.clamp(1, 20);
  let window_for_work = window.clone();
  run_on_window_main(&window, move || {
    let mut create_ms = Vec::with_capacity(n as usize);
    let mut destroy_ms = Vec::with_capacity(n as usize);
    let bounds = CefBounds {
      x: 8.0,
      y: 8.0,
      width: 320.0,
      height: 240.0,
    };

    for _ in 0..n {
      let started = Instant::now();
      let id = runtime::create_browser_on_main(&window_for_work, bounds)?;
      create_ms.push(started.elapsed().as_secs_f64() * 1000.0);

      let started = Instant::now();
      runtime::destroy_browser_on_main(&id)?;
      destroy_ms.push(started.elapsed().as_secs_f64() * 1000.0);

      pump_on_main_thread();
    }

    let avg_create_ms = create_ms.iter().sum::<f64>() / create_ms.len() as f64;
    let avg_destroy_ms = destroy_ms.iter().sum::<f64>() / destroy_ms.len() as f64;

    Ok(BrowserCefBenchResult {
      iterations: n,
      create_ms,
      destroy_ms,
      avg_create_ms,
      avg_destroy_ms,
    })
  })
}
