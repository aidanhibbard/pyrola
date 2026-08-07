//! Embedded OS webview browser (no Playwright sidecar).
//!
//! Creates a Tauri child webview labeled `browser` over the workbench Browser pane.
//! Agent tools drive it via navigate + JS eval. CDP is not available.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex as StdMutex;
use std::time::{Duration, Instant};

use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::webview::{PageLoadEvent, WebviewBuilder};
use tauri::{
  AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Url, WebviewUrl,
};
use tokio::sync::{oneshot, Mutex};

use super::paths::user_pyrola_dir;

const BROWSER_LABEL: &str = "browser";
const MAIN_TAB_ID: &str = "main";
const USER_SENTINEL: &str = "user";
const LOCK_TTL: Duration = Duration::from_secs(5 * 60);
const EVAL_TIMEOUT: Duration = Duration::from_secs(45);

const LOCK_REQUIRED_METHODS: &[&str] = &[
  "click",
  "hover",
  "type",
  "fill",
  "selectOption",
  "pressKey",
  "scroll",
  "drag",
  "tabs.close",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserStatus {
  pub running: bool,
  pub error: Option<String>,
  #[serde(default)]
  pub locks: HashMap<String, String>,
  #[serde(default)]
  pub url: Option<String>,
  #[serde(default)]
  pub title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserArtifact {
  pub path: String,
  pub mime_type: String,
  pub base64: String,
  pub size_bytes: u64,
}

struct TabLock {
  chat_id: String,
  #[allow(dead_code)]
  acquired_at: Instant,
  last_activity: Instant,
}

#[derive(Default, Clone)]
struct BrowserPolicy {
  allowed_domains: Vec<String>,
  denied_domains: Vec<String>,
}

#[derive(Default)]
struct BrowserMeta {
  url: String,
  title: String,
  shared: bool,
  visible: bool,
  /// Logical bounds last applied from the UI (for screenshots).
  bounds: Option<(f64, f64, f64, f64)>,
  last_error: Option<String>,
}

lazy_static::lazy_static! {
  static ref BROWSER_LOCKS: Mutex<HashMap<String, TabLock>> = Mutex::new(HashMap::new());
  static ref BROWSER_POLICY: StdMutex<BrowserPolicy> = StdMutex::new(BrowserPolicy::default());
  static ref BROWSER_META: Mutex<BrowserMeta> = Mutex::new(BrowserMeta::default());
  /// CSS selector / path keyed by snapshot ref (e1, e2, …)
  static ref SNAPSHOT_REFS: StdMutex<HashMap<String, String>> = StdMutex::new(HashMap::new());
}

fn browser_dirs(app: &AppHandle) -> Result<(PathBuf, PathBuf), String> {
  let root = user_pyrola_dir(app)?.join("browser");
  let shots = root.join("shots");
  for dir in [&root, &shots] {
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
  }
  Ok((root, shots))
}

fn host_from_url(url: &str) -> String {
  Url::parse(url)
    .ok()
    .and_then(|u| u.host_str().map(|h| h.to_string()))
    .unwrap_or_else(|| url.to_string())
}

fn domain_matches(pattern: &str, host: &str) -> bool {
  let pattern = pattern.trim().to_lowercase();
  let host = host.to_lowercase();
  if pattern.is_empty() {
    return false;
  }
  if let Some(suffix) = pattern.strip_prefix("*.") {
    host == suffix || host.ends_with(&format!(".{suffix}"))
  } else {
    host == pattern
  }
}

fn domain_allowed(policy: &BrowserPolicy, url: &str) -> Result<(), String> {
  let host = host_from_url(url);
  if policy
    .denied_domains
    .iter()
    .any(|d| domain_matches(d, &host))
  {
    return Err(format!(
      "Navigation denied for host '{host}' (denied domain policy)"
    ));
  }
  if !policy.allowed_domains.is_empty()
    && !policy
      .allowed_domains
      .iter()
      .any(|d| domain_matches(d, &host))
  {
    return Err(format!(
      "Navigation blocked for host '{host}' (not in allowed domains)"
    ));
  }
  Ok(())
}

fn expire_stale_locks(locks: &mut HashMap<String, TabLock>) {
  let now = Instant::now();
  locks.retain(|_, lock| now.duration_since(lock.last_activity) < LOCK_TTL);
}

async fn snapshot_locks() -> HashMap<String, String> {
  let mut locks = BROWSER_LOCKS.lock().await;
  expire_stale_locks(&mut locks);
  locks
    .iter()
    .map(|(tab_id, lock)| (tab_id.clone(), lock.chat_id.clone()))
    .collect()
}

fn method_requires_lock(method: &str) -> bool {
  LOCK_REQUIRED_METHODS.contains(&method)
}

async fn require_tab_lock(tab_id: &str, chat_id: &str) -> Result<(), String> {
  let mut locks = BROWSER_LOCKS.lock().await;
  expire_stale_locks(&mut locks);
  match locks.get_mut(tab_id) {
    Some(lock) if lock.chat_id == chat_id => {
      lock.last_activity = Instant::now();
      Ok(())
    }
    Some(lock) => Err(format!("Tab locked_by:{}", lock.chat_id)),
    None => Err(format!(
      "Tab '{tab_id}' is not locked; acquire lock before this method (chat_id={chat_id})"
    )),
  }
}

async fn touch_lock_if_holder(tab_id: &str, chat_id: &str) {
  let mut locks = BROWSER_LOCKS.lock().await;
  expire_stale_locks(&mut locks);
  if let Some(lock) = locks.get_mut(tab_id) {
    if lock.chat_id == chat_id {
      lock.last_activity = Instant::now();
    }
  }
}

fn get_browser_webview(app: &AppHandle) -> Result<tauri::Webview, String> {
  app
    .get_webview(BROWSER_LABEL)
    .ok_or_else(|| "Browser webview is not running".to_string())
}

async fn eval_json(app: &AppHandle, expression: &str) -> Result<Value, String> {
  let webview = get_browser_webview(app)?;
  let (tx, rx) = oneshot::channel::<String>();
  let tx = StdMutex::new(Some(tx));
  // Wrap so Promise results resolve and errors become JSON.
  let script = format!(
    r#"(async () => {{
  try {{
    const __v = await ({expression});
    return JSON.stringify({{ ok: true, value: __v }});
  }} catch (e) {{
    return JSON.stringify({{ ok: false, error: String(e && e.message ? e.message : e) }});
  }}
}})()"#
  );
  webview
    .eval_with_callback(script, move |result| {
      if let Ok(mut guard) = tx.lock() {
        if let Some(sender) = guard.take() {
          let _ = sender.send(result);
        }
      }
    })
    .map_err(|e| e.to_string())?;

  let raw = tokio::time::timeout(EVAL_TIMEOUT, rx)
    .await
    .map_err(|_| "browser eval timed out".to_string())?
    .map_err(|_| "browser eval channel closed".to_string())?;

  let parsed: Value = serde_json::from_str(&raw).unwrap_or(Value::String(raw.clone()));
  if let Some(obj) = parsed.as_object() {
    if obj.get("ok").and_then(|v| v.as_bool()) == Some(false) {
      let err = obj
        .get("error")
        .and_then(|v| v.as_str())
        .unwrap_or("browser eval failed");
      return Err(err.to_string());
    }
    if let Some(value) = obj.get("value") {
      return Ok(value.clone());
    }
  }
  Ok(parsed)
}

async fn eval_void(app: &AppHandle, expression: &str) -> Result<(), String> {
  let _ = eval_json(app, expression).await?;
  Ok(())
}

fn ensure_created(app: &AppHandle) -> Result<(), String> {
  if app.get_webview(BROWSER_LABEL).is_some() {
    return Ok(());
  }

  let window = app
    .get_window("main")
    .ok_or_else(|| "Main window not found".to_string())?;

  let app_for_nav = app.clone();
  let builder = WebviewBuilder::new(
    BROWSER_LABEL,
    WebviewUrl::External("about:blank".parse().map_err(|e: url::ParseError| e.to_string())?),
  )
  // Prefer a desktop Chrome UA so sites (e.g. Google) serve the same layout as Cursor/Electron.
  .user_agent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  )
  .on_navigation({
    move |url| {
      let url_str = url.as_str().to_string();
      if url_str == "about:blank" || url.scheme() == "about" {
        return true;
      }
      if let Ok(policy) = BROWSER_POLICY.try_lock() {
        if domain_allowed(&policy, &url_str).is_err() {
          return false;
        }
      }
      true
    }
  })
  .on_page_load({
    let app = app_for_nav.clone();
    move |webview, payload| {
      if payload.event() != PageLoadEvent::Finished {
        return;
      }
      let url = payload.url().to_string();
      let app2 = app.clone();
      let wv = webview.clone();
      let _ = wv.eval_with_callback("document.title || ''".to_string(), move |title_raw| {
        let title = serde_json::from_str::<String>(&title_raw)
          .unwrap_or_else(|_| title_raw.trim_matches('"').to_string());
        let app3 = app2.clone();
        let url2 = url.clone();
        tauri::async_runtime::spawn(async move {
          {
            let mut meta = BROWSER_META.lock().await;
            meta.url = url2.clone();
            meta.title = title.clone();
          }
          let _ = app3.emit(
            "browser-navigated",
            json!({
              "tabId": MAIN_TAB_ID,
              "url": url2,
              "title": title,
            }),
          );
        });
      });
    }
  });

  let _webview = window
    .add_child(
      builder,
      // Park off-screen immediately — a 1×1 at (0,0) still covers Vue briefly.
      LogicalPosition::new(-10_000.0, -10_000.0),
      LogicalSize::new(1.0, 1.0),
    )
    .map_err(|e| e.to_string())?;

  // Start hidden until BrowserTab sets bounds + visibility.
  // BrowserMeta.visible defaults to false; set_bounds will not apply on-screen.
  if let Some(wv) = app.get_webview(BROWSER_LABEL) {
    let _ = wv.hide();
  }

  Ok(())
}

#[tauri::command]
pub async fn browser_start(app: AppHandle) -> Result<BrowserStatus, String> {
  ensure_created(&app)?;
  {
    let mut meta = BROWSER_META.lock().await;
    meta.last_error = None;
  }
  browser_status(app).await
}

#[tauri::command]
pub async fn browser_stop(app: AppHandle) -> Result<(), String> {
  if let Some(wv) = app.get_webview(BROWSER_LABEL) {
    wv.close().map_err(|e| e.to_string())?;
  }
  {
    let mut locks = BROWSER_LOCKS.lock().await;
    locks.clear();
  }
  {
    let mut meta = BROWSER_META.lock().await;
    *meta = BrowserMeta::default();
  }
  if let Ok(mut refs) = SNAPSHOT_REFS.lock() {
    refs.clear();
  }
  Ok(())
}

#[tauri::command]
pub async fn browser_status(app: AppHandle) -> Result<BrowserStatus, String> {
  let running = app.get_webview(BROWSER_LABEL).is_some();
  let meta = BROWSER_META.lock().await;
  Ok(BrowserStatus {
    running,
    error: meta.last_error.clone(),
    locks: snapshot_locks().await,
    url: if meta.url.is_empty() {
      None
    } else {
      Some(meta.url.clone())
    },
    title: if meta.title.is_empty() {
      None
    } else {
      Some(meta.title.clone())
    },
  })
}

#[tauri::command]
pub async fn browser_set_policy(
  allowed_domains: Vec<String>,
  denied_domains: Vec<String>,
) -> Result<(), String> {
  let mut policy = BROWSER_POLICY
    .lock()
    .map_err(|_| "browser policy lock poisoned".to_string())?;
  *policy = BrowserPolicy {
    allowed_domains,
    denied_domains,
  };
  Ok(())
}

#[tauri::command]
pub async fn browser_set_bounds(
  app: AppHandle,
  x: f64,
  y: f64,
  width: f64,
  height: f64,
) -> Result<(), String> {
  ensure_created(&app)?;
  let webview = get_browser_webview(&app)?;
  let w = width.max(1.0);
  let h = height.max(1.0);
  // Hold the meta lock across store + apply so this cannot race
  // browser_set_visible(false) and yank the parked webview back on-screen
  // (ResizeObserver / layout sync used to undo modal parking).
  let mut meta = BROWSER_META.lock().await;
  meta.bounds = Some((x, y, w, h));
  if meta.visible {
    webview
      .set_position(LogicalPosition::new(x, y))
      .map_err(|e| e.to_string())?;
    webview
      .set_size(LogicalSize::new(w, h))
      .map_err(|e| e.to_string())?;
  }
  Ok(())
}

#[tauri::command]
pub async fn browser_set_visible(app: AppHandle, visible: bool) -> Result<(), String> {
  ensure_created(&app)?;
  let webview = get_browser_webview(&app)?;
  let mut meta = BROWSER_META.lock().await;
  if visible {
    if let Some((x, y, w, h)) = meta.bounds {
      webview
        .set_position(LogicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;
      webview
        .set_size(LogicalSize::new(w.max(1.0), h.max(1.0)))
        .map_err(|e| e.to_string())?;
    }
    webview.show().map_err(|e| e.to_string())?;
  } else {
    // hide() alone is not enough on some platforms — park off-screen so the
    // native view cannot cover Vue dialogs/sheets.
    let _ = webview.hide();
    webview
      .set_position(LogicalPosition::new(-10_000.0, -10_000.0))
      .map_err(|e| e.to_string())?;
    webview
      .set_size(LogicalSize::new(1.0, 1.0))
      .map_err(|e| e.to_string())?;
  }
  meta.visible = visible;
  Ok(())
}

#[tauri::command]
pub async fn browser_eval(app: AppHandle, script: String) -> Result<Value, String> {
  ensure_created(&app)?;
  eval_json(&app, &script).await
}

async fn navigate_to(app: &AppHandle, url: &str) -> Result<Value, String> {
  {
    let policy = BROWSER_POLICY
      .lock()
      .map_err(|_| "browser policy lock poisoned".to_string())?;
    domain_allowed(&policy, url)?;
  }
  let parsed: Url = url
    .parse()
    .map_err(|e: url::ParseError| format!("Invalid URL: {e}"))?;
  let webview = get_browser_webview(app)?;
  webview.navigate(parsed).map_err(|e| e.to_string())?;
  {
    let mut meta = BROWSER_META.lock().await;
    meta.url = url.to_string();
  }
  Ok(json!({
    "tabId": MAIN_TAB_ID,
    "url": url,
  }))
}

async fn capture_element_crop(
  app: &AppHandle,
  shots: &Path,
  box_val: &Value,
) -> Result<String, String> {
  let x = box_val
    .get("x")
    .and_then(|v| v.as_f64())
    .ok_or_else(|| "missing box x".to_string())?;
  let y = box_val
    .get("y")
    .and_then(|v| v.as_f64())
    .ok_or_else(|| "missing box y".to_string())?;
  let w = box_val
    .get("width")
    .and_then(|v| v.as_f64())
    .unwrap_or(0.0)
    .max(1.0);
  let h = box_val
    .get("height")
    .and_then(|v| v.as_f64())
    .unwrap_or(0.0)
    .max(1.0);

  #[cfg(not(target_os = "macos"))]
  {
    let _ = (app, shots, x, y, w, h);
    return Err("element crop not supported on this platform".to_string());
  }

  #[cfg(target_os = "macos")]
  {
    let path = shots.join(format!("element-{}.png", uuid::Uuid::new_v4()));
    let webview = get_browser_webview(app)?;
    let position = webview.position().map_err(|e| e.to_string())?;
    let scale = app
      .get_window("main")
      .and_then(|win| win.scale_factor().ok())
      .unwrap_or(1.0);
    let origin_x = (position.x as f64) / scale;
    let origin_y = (position.y as f64) / scale;
    let region = format!(
      "{},{},{},{}",
      (origin_x + x).round() as i32,
      (origin_y + y).round() as i32,
      w.round() as i32,
      h.round() as i32
    );
    let status = std::process::Command::new("screencapture")
      .args(["-x", "-R", &region, path.to_str().unwrap_or("")])
      .status()
      .map_err(|e| e.to_string())?;
    if !status.success() {
      return Err("element screencapture failed".to_string());
    }
    if !path.exists() {
      return Err("element crop missing".to_string());
    }
    Ok(path.to_string_lossy().to_string())
  }
}

async fn capture_screenshot(app: &AppHandle, shots: &Path) -> Result<Value, String> {
  let path = shots.join(format!("shot-{}.png", uuid::Uuid::new_v4()));

  #[cfg(target_os = "macos")]
  {
    let webview = get_browser_webview(app)?;
    let position = webview.position().map_err(|e| e.to_string())?;
    let size = webview.size().map_err(|e| e.to_string())?;
    // position/size are already physical pixels for screencapture -R on macOS Retina
    // but screencapture -R uses points (logical). Convert using window scale.
    let scale = app
      .get_window("main")
      .and_then(|w| w.scale_factor().ok())
      .unwrap_or(1.0);
    let x = (position.x as f64) / scale;
    let y = (position.y as f64) / scale;
    let w = (size.width as f64) / scale;
    let h = (size.height as f64) / scale;
    let region = format!(
      "{},{},{},{}",
      x.round() as i32,
      y.round() as i32,
      w.round().max(1.0) as i32,
      h.round().max(1.0) as i32
    );
    let status = std::process::Command::new("screencapture")
      .args(["-x", "-R", &region, path.to_str().unwrap_or("")])
      .status()
      .map_err(|e| e.to_string())?;
    if !status.success() {
      return Err("screencapture failed".to_string());
    }
  }

  #[cfg(not(target_os = "macos"))]
  {
    let _ = (app, shots);
    // Fallback: capture document as data URL via canvas of viewport (limited).
    let data_url = eval_json(
      app,
      r#"(() => {
        const w = Math.max(document.documentElement.clientWidth, 1);
        const h = Math.max(document.documentElement.clientHeight, 1);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        if (!ctx) throw new Error('no canvas');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0,0,w,h);
        ctx.fillStyle = '#111';
        ctx.font = '14px sans-serif';
        ctx.fillText(document.title || location.href, 16, 32);
        ctx.fillText('(Screenshot capture is limited on this platform)', 16, 56);
        return c.toDataURL('image/png');
      })()"#,
    )
    .await?;
    let data_url = data_url
      .as_str()
      .ok_or_else(|| "screenshot eval did not return a string".to_string())?;
    let b64 = data_url
      .strip_prefix("data:image/png;base64,")
      .ok_or_else(|| "unexpected screenshot data URL".to_string())?;
    let bytes = base64::engine::general_purpose::STANDARD
      .decode(b64)
      .map_err(|e| e.to_string())?;
    fs::write(&path, bytes).map_err(|e| e.to_string())?;
  }

  if !path.exists() {
    return Err("screenshot file was not created".to_string());
  }

  Ok(json!({
    "path": path.to_string_lossy(),
    "tabId": MAIN_TAB_ID,
  }))
}

const SNAPSHOT_JS: &str = r#"(() => {
  const refs = {};
  let n = 0;
  const lines = [];
  const walk = (el, depth) => {
    if (!el || el.nodeType !== 1) return;
    if (['SCRIPT','STYLE','NOSCRIPT','META','LINK'].includes(el.tagName)) return;
    const ref = 'e' + (++n);
    const id = el.id ? '#' + CSS.escape(el.id) : '';
    let path = el.tagName.toLowerCase() + id;
    if (!el.id) {
      const parent = el.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
        if (siblings.length > 1) {
          path += ':nth-of-type(' + (siblings.indexOf(el) + 1) + ')';
        }
      }
    }
    // Build a simple selector chain
    const parts = [];
    let cur = el;
    for (let i = 0; i < 6 && cur && cur.nodeType === 1; i++) {
      let part = cur.tagName.toLowerCase();
      if (cur.id) { parts.unshift(part + '#' + CSS.escape(cur.id)); break; }
      const parent = cur.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === cur.tagName);
        if (siblings.length > 1) part += ':nth-of-type(' + (siblings.indexOf(cur) + 1) + ')';
      }
      parts.unshift(part);
      cur = parent;
    }
    const selector = parts.join(' > ');
    refs[ref] = selector;
    const role = el.getAttribute('role') || '';
    const name = (el.getAttribute('aria-label') || el.innerText || el.value || '').trim().slice(0, 80).replace(/\s+/g, ' ');
    const indent = '  '.repeat(depth);
    lines.push(indent + '- ' + el.tagName.toLowerCase() + (role ? ' [role=' + role + ']' : '') + (name ? ' "' + name + '"' : '') + ' [' + ref + ']');
    const kids = Array.from(el.children).slice(0, 40);
    for (const kid of kids) walk(kid, depth + 1);
  };
  walk(document.body, 0);
  window.__pyrolaRefs = refs;
  return { snapshot: lines.slice(0, 400).join('\n'), refs, url: location.href, title: document.title };
})()"#;

const INTERACT_HELPERS: &str = r#"
(() => {
  const resolve = (ref) => {
    const map = window.__pyrolaRefs || {};
    const sel = map[ref];
    if (!sel) throw new Error('Unknown ref: ' + ref + ' — take a fresh browser_snapshot');
    const el = document.querySelector(sel);
    if (!el) throw new Error('Element not found for ref: ' + ref);
    return el;
  };
  window.__pyrolaResolve = resolve;
  return true;
})()
"#;

async fn handle_method(
  app: &AppHandle,
  method: &str,
  params: &Value,
) -> Result<Value, String> {
  let (_root, shots) = browser_dirs(app)?;
  ensure_created(app)?;

  match method {
    "ping" => Ok(json!({ "ok": true })),

    "tabs.list" => {
      let meta = BROWSER_META.lock().await;
      Ok(json!({
        "tabs": [{
          "id": MAIN_TAB_ID,
          "url": meta.url,
          "title": meta.title,
          "shared": meta.shared,
        }]
      }))
    }

    "tabs.select" => Ok(json!({ "ok": true, "tabId": MAIN_TAB_ID })),

    "tabs.close" => Err("Closing the embedded browser tab is not supported".to_string()),

    "navigate" => {
      let url = params
        .get("url")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "url is required".to_string())?;
      navigate_to(app, url).await
    }

    "goBack" => {
      eval_void(app, "history.back()").await?;
      Ok(json!({ "ok": true }))
    }
    "goForward" => {
      eval_void(app, "history.forward()").await?;
      Ok(json!({ "ok": true }))
    }
    "reload" => {
      let webview = get_browser_webview(app)?;
      webview.reload().map_err(|e| e.to_string())?;
      Ok(json!({ "ok": true }))
    }
    "hardReload" => {
      eval_void(app, "location.reload(true)").await?;
      Ok(json!({ "ok": true }))
    }

    "setShared" => {
      let shared = params
        .get("shared")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
      let mut meta = BROWSER_META.lock().await;
      meta.shared = shared;
      Ok(json!({ "ok": true, "shared": shared }))
    }

    "snapshot" => {
      let result = eval_json(app, SNAPSHOT_JS).await?;
      if let Some(refs) = result.get("refs").and_then(|v| v.as_object()) {
        if let Ok(mut store) = SNAPSHOT_REFS.lock() {
          store.clear();
          for (k, v) in refs {
            if let Some(sel) = v.as_str() {
              store.insert(k.clone(), sel.to_string());
            }
          }
        }
      }
      Ok(json!({
        "tabId": MAIN_TAB_ID,
        "url": result.get("url").cloned().unwrap_or(Value::Null),
        "title": result.get("title").cloned().unwrap_or(Value::Null),
        "snapshot": result.get("snapshot").cloned().unwrap_or(Value::String(String::new())),
      }))
    }

    "screenshot" => capture_screenshot(app, &shots).await,

    "click" | "hover" | "type" | "fill" | "selectOption" | "pressKey" | "scroll" | "drag"
    | "highlight" | "getBoundingBox" => {
      let _ = eval_json(app, INTERACT_HELPERS).await;
      let ref_id = params
        .get("ref")
        .and_then(|v| v.as_str())
        .unwrap_or("");
      match method {
        "click" => {
          let script = format!(
            r#"(() => {{ const el = window.__pyrolaResolve({ref}); el.click(); return {{ ok: true }}; }})()"#,
            ref = serde_json::to_string(ref_id).unwrap()
          );
          eval_json(app, &script).await
        }
        "hover" => {
          let script = format!(
            r#"(() => {{ const el = window.__pyrolaResolve({ref}); el.dispatchEvent(new MouseEvent('mouseover', {{ bubbles: true }})); return {{ ok: true }}; }})()"#,
            ref = serde_json::to_string(ref_id).unwrap()
          );
          eval_json(app, &script).await
        }
        "type" => {
          let text = params.get("text").and_then(|v| v.as_str()).unwrap_or("");
          let script = format!(
            r#"(() => {{
              const el = window.__pyrolaResolve({ref});
              el.focus();
              if ('value' in el) el.value = (el.value || '') + {text};
              else el.textContent = (el.textContent || '') + {text};
              el.dispatchEvent(new Event('input', {{ bubbles: true }}));
              return {{ ok: true }};
            }})()"#,
            ref = serde_json::to_string(ref_id).unwrap(),
            text = serde_json::to_string(text).unwrap()
          );
          eval_json(app, &script).await
        }
        "fill" => {
          let value = params.get("value").and_then(|v| v.as_str()).unwrap_or("");
          let script = format!(
            r#"(() => {{
              const el = window.__pyrolaResolve({ref});
              el.focus();
              if ('value' in el) el.value = {value};
              else el.textContent = {value};
              el.dispatchEvent(new Event('input', {{ bubbles: true }}));
              el.dispatchEvent(new Event('change', {{ bubbles: true }}));
              return {{ ok: true }};
            }})()"#,
            ref = serde_json::to_string(ref_id).unwrap(),
            value = serde_json::to_string(value).unwrap()
          );
          eval_json(app, &script).await
        }
        "selectOption" => {
          let values = params.get("values").cloned().unwrap_or(json!([]));
          let script = format!(
            r#"(() => {{
              const el = window.__pyrolaResolve({ref});
              const values = {values};
              if (el.tagName === 'SELECT') {{
                Array.from(el.options).forEach(o => {{ o.selected = values.includes(o.value) || values.includes(o.text); }});
                el.dispatchEvent(new Event('change', {{ bubbles: true }}));
              }}
              return {{ ok: true }};
            }})()"#,
            ref = serde_json::to_string(ref_id).unwrap(),
            values = values
          );
          eval_json(app, &script).await
        }
        "pressKey" => {
          let key = params.get("key").and_then(|v| v.as_str()).unwrap_or("Enter");
          let script = format!(
            r#"(() => {{
              const opts = {{ key: {key}, bubbles: true }};
              document.activeElement && document.activeElement.dispatchEvent(new KeyboardEvent('keydown', opts));
              document.activeElement && document.activeElement.dispatchEvent(new KeyboardEvent('keyup', opts));
              return {{ ok: true }};
            }})()"#,
            key = serde_json::to_string(key).unwrap()
          );
          eval_json(app, &script).await
        }
        "scroll" => {
          let direction = params
            .get("direction")
            .and_then(|v| v.as_str())
            .unwrap_or("down");
          let amount = params.get("amount").and_then(|v| v.as_f64()).unwrap_or(400.0);
          let (dx, dy) = match direction {
            "up" => (0.0, -amount),
            "left" => (-amount, 0.0),
            "right" => (amount, 0.0),
            _ => (0.0, amount),
          };
          if !ref_id.is_empty() {
            let script = format!(
              r#"(() => {{ window.__pyrolaResolve({ref}).scrollIntoView({{ block: 'center', inline: 'nearest' }}); return {{ ok: true }}; }})()"#,
              ref = serde_json::to_string(ref_id).unwrap()
            );
            eval_json(app, &script).await
          } else {
            let script = format!(
              r#"(() => {{ window.scrollBy({dx}, {dy}); return {{ ok: true }}; }})()"#,
              dx = dx,
              dy = dy
            );
            eval_json(app, &script).await
          }
        }
        "drag" => {
          let from = params.get("fromRef").and_then(|v| v.as_str()).unwrap_or("");
          let to = params.get("toRef").and_then(|v| v.as_str()).unwrap_or("");
          let script = format!(
            r#"(() => {{
              const a = window.__pyrolaResolve({from});
              const b = window.__pyrolaResolve({to});
              a.dispatchEvent(new DragEvent('dragstart', {{ bubbles: true }}));
              b.dispatchEvent(new DragEvent('drop', {{ bubbles: true }}));
              a.dispatchEvent(new DragEvent('dragend', {{ bubbles: true }}));
              return {{ ok: true }};
            }})()"#,
            from = serde_json::to_string(from).unwrap(),
            to = serde_json::to_string(to).unwrap()
          );
          eval_json(app, &script).await
        }
        "highlight" => {
          let script = format!(
            r#"(() => {{
              const el = window.__pyrolaResolve({ref});
              const prev = el.style.outline;
              el.style.outline = '2px solid #f59e0b';
              setTimeout(() => {{ el.style.outline = prev; }}, 1200);
              return {{ ok: true, text: (el.innerText || el.value || '').slice(0, 200) }};
            }})()"#,
            ref = serde_json::to_string(ref_id).unwrap()
          );
          eval_json(app, &script).await
        }
        "getBoundingBox" => {
          let script = format!(
            r#"(() => {{
              const el = window.__pyrolaResolve({ref});
              const r = el.getBoundingClientRect();
              return {{ box: {{ x: r.x, y: r.y, width: r.width, height: r.height }} }};
            }})()"#,
            ref = serde_json::to_string(ref_id).unwrap()
          );
          eval_json(app, &script).await
        }
        _ => unreachable!(),
      }
    }

    "cdp" => Err(
      "browser_cdp is not available: the embedded OS webview has no CDP. Use browser_snapshot and interact tools instead."
        .to_string(),
    ),

    "selectElement.start" => {
      let result = eval_json(
        app,
        r#"(async () => {
  return await new Promise((resolve, reject) => {
    const overlay = document.createElement('div');
    overlay.id = '__pyrola_select_overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;cursor:crosshair;background:transparent;';
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;pointer-events:none;border:2px solid #3b82f6;background:rgba(59,130,246,0.12);z-index:2147483647;box-sizing:border-box;';
    const tip = document.createElement('div');
    tip.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;background:#2563eb;color:#fff;font:12px/1.3 ui-sans-serif,system-ui,sans-serif;padding:4px 8px;border-radius:4px;max-width:min(360px,70vw);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    tip.textContent = 'Click to select';
    document.documentElement.appendChild(overlay);
    document.documentElement.appendChild(box);
    document.documentElement.appendChild(tip);
    let current = null;
    const cssEscape = (value) => {
      if (window.CSS && typeof CSS.escape === 'function') return CSS.escape(value);
      return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    };
    const hitTest = (x, y) => {
      overlay.style.pointerEvents = 'none';
      const el = document.elementFromPoint(x, y);
      overlay.style.pointerEvents = 'auto';
      return el;
    };
    const buildSelector = (el) => {
      if (!el || el.nodeType !== 1) return '';
      if (el.id) return '#' + cssEscape(el.id);
      const testId = el.getAttribute('data-testid') || el.getAttribute('data-test');
      if (testId) return '[data-testid="' + String(testId).replace(/"/g, '\\"') + '"]';
      const aria = el.getAttribute('aria-label');
      if (aria) {
        return el.tagName.toLowerCase() + '[aria-label="' + String(aria).replace(/"/g, '\\"').slice(0, 80) + '"]';
      }
      const parts = [];
      let cur = el;
      for (let i = 0; i < 8 && cur && cur.nodeType === 1 && cur !== document.documentElement; i++) {
        let part = cur.tagName.toLowerCase();
        if (cur.id) { parts.unshift('#' + cssEscape(cur.id)); break; }
        const parent = cur.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter((c) => c.tagName === cur.tagName);
          if (siblings.length > 1) part += ':nth-of-type(' + (siblings.indexOf(cur) + 1) + ')';
        }
        const cls = Array.from(cur.classList || []).filter((c) => c && !c.startsWith('__pyrola') && c.length < 40).slice(0, 2);
        if (cls.length) part += '.' + cls.map(cssEscape).join('.');
        parts.unshift(part);
        cur = parent;
      }
      return parts.join(' > ');
    };
    const cleanup = () => {
      overlay.remove();
      box.remove();
      tip.remove();
      window.removeEventListener('keydown', onKey, true);
      window.__pyrolaSelectCancel = null;
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cleanup();
        reject(new Error('selectElement cancelled'));
      }
    };
    window.__pyrolaSelectCancel = () => { cleanup(); reject(new Error('selectElement cancelled')); };
    const onMove = (e) => {
      const el = hitTest(e.clientX, e.clientY);
      if (!el || el === document.documentElement || el === document.body) return;
      if (el === overlay || el === box || el === tip) return;
      current = el;
      const r = el.getBoundingClientRect();
      box.style.left = r.left + 'px';
      box.style.top = r.top + 'px';
      box.style.width = Math.max(0, r.width) + 'px';
      box.style.height = Math.max(0, r.height) + 'px';
      const selector = buildSelector(el) || el.tagName.toLowerCase();
      tip.textContent = selector + ' · Click to select';
      tip.style.left = Math.min(window.innerWidth - 24, Math.max(8, r.left)) + 'px';
      tip.style.top = Math.min(window.innerHeight - 28, r.bottom + 6) + 'px';
    };
    const onClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const el = current || hitTest(e.clientX, e.clientY);
      if (!el || el === overlay || el === box || el === tip) return;
      const r = el.getBoundingClientRect();
      const selector = buildSelector(el);
      const payload = {
        selector: selector || el.tagName.toLowerCase(),
        tagName: el.tagName.toLowerCase(),
        role: el.getAttribute('role') || null,
        name: (el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.innerText || el.value || '').trim().slice(0, 160),
        outerHTML: (el.outerHTML || '').slice(0, 2500),
        boundingBox: { x: r.x, y: r.y, width: r.width, height: r.height },
      };
      cleanup();
      resolve(payload);
    };
    overlay.addEventListener('mousemove', onMove);
    overlay.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey, true);
  });
})()"#,
      )
      .await?;

      let mut out = result;
      if let Some(obj) = out.as_object_mut() {
        obj.insert("tabId".into(), json!(MAIN_TAB_ID));
        let url = BROWSER_META.lock().await.url.clone();
        obj.insert("url".into(), json!(url));
        obj.insert(
          "htmlSnippet".into(),
          obj.get("outerHTML").cloned().unwrap_or(Value::Null),
        );
        if let Some(box_val) = obj.get("boundingBox").cloned() {
          if let Ok((_, shots)) = browser_dirs(app) {
            if let Ok(crop) = capture_element_crop(app, &shots, &box_val).await {
              obj.insert("cropScreenshotPath".into(), json!(crop));
              obj.insert("screenshotPath".into(), json!(crop));
            }
          }
        }
      }
      Ok(out)
    }

    "selectElement.cancel" => {
      let _ = eval_void(app, "window.__pyrolaSelectCancel && window.__pyrolaSelectCancel()").await;
      Ok(json!({ "ok": true }))
    }

    "clearCookies" => {
      // Best-effort: clear document cookies for current origin.
      eval_void(
        app,
        r#"(() => {
          document.cookie.split(';').forEach(c => {
            const n = c.split('=')[0].trim();
            if (n) document.cookie = n + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
          });
        })()"#,
      )
      .await?;
      Ok(json!({ "ok": true }))
    }

    "clearCache" => {
      eval_void(app, "location.reload(true)").await?;
      Ok(json!({ "ok": true }))
    }

    "clearHistory" => {
      navigate_to(app, "about:blank").await?;
      Ok(json!({ "ok": true }))
    }

    "resize" => Ok(json!({ "ok": true })),

    other => Err(format!("Unknown browser method: {other}")),
  }
}

#[tauri::command]
pub async fn browser_request(
  app: AppHandle,
  method: String,
  params: Option<Value>,
  chat_id: Option<String>,
) -> Result<Value, String> {
  let params = params.unwrap_or_else(|| json!({}));
  let tab_id = params
    .get("tabId")
    .and_then(|v| v.as_str())
    .unwrap_or(MAIN_TAB_ID);

  if method_requires_lock(&method) {
    let Some(chat_id) = chat_id.as_deref() else {
      return Err("chatId is required for this browser method".to_string());
    };
    require_tab_lock(tab_id, chat_id).await?;
  } else if let Some(chat_id) = chat_id.as_deref() {
    touch_lock_if_holder(tab_id, chat_id).await;
  }

  match handle_method(&app, &method, &params).await {
    Ok(v) => Ok(v),
    Err(e) => {
      let mut meta = BROWSER_META.lock().await;
      meta.last_error = Some(e.clone());
      Err(e)
    }
  }
}

#[tauri::command]
pub async fn browser_lock(tab_id: String, chat_id: String) -> Result<Value, String> {
  let mut locks = BROWSER_LOCKS.lock().await;
  expire_stale_locks(&mut locks);
  if let Some(existing) = locks.get(&tab_id) {
    if existing.chat_id != chat_id {
      return Err(format!("Tab locked_by:{}", existing.chat_id));
    }
    if let Some(lock) = locks.get_mut(&tab_id) {
      lock.last_activity = Instant::now();
    }
    return Ok(json!({ "ok": true, "lockedBy": chat_id }));
  }
  locks.insert(
    tab_id,
    TabLock {
      chat_id: chat_id.clone(),
      acquired_at: Instant::now(),
      last_activity: Instant::now(),
    },
  );
  Ok(json!({ "ok": true, "lockedBy": chat_id }))
}

#[tauri::command]
pub async fn browser_unlock(tab_id: String, chat_id: String) -> Result<(), String> {
  let mut locks = BROWSER_LOCKS.lock().await;
  expire_stale_locks(&mut locks);
  match locks.get(&tab_id) {
    Some(lock) if lock.chat_id == chat_id || chat_id == USER_SENTINEL => {
      locks.remove(&tab_id);
      Ok(())
    }
    Some(lock) => Err(format!("Tab locked_by:{}", lock.chat_id)),
    None => Ok(()),
  }
}

#[tauri::command]
pub async fn browser_unlock_all(chat_id: String) -> Result<u32, String> {
  let mut locks = BROWSER_LOCKS.lock().await;
  let before = locks.len();
  locks.retain(|_, lock| lock.chat_id != chat_id);
  let removed = before.saturating_sub(locks.len());
  Ok(removed as u32)
}

#[tauri::command]
pub async fn browser_read_artifact(app: AppHandle, path: String) -> Result<BrowserArtifact, String> {
  let (browser_root, _) = browser_dirs(&app)?;
  let browser_root = fs::canonicalize(&browser_root).map_err(|e| e.to_string())?;
  let candidate = if Path::new(&path).is_absolute() {
    PathBuf::from(&path)
  } else {
    browser_root.join(&path)
  };
  let canonical = fs::canonicalize(&candidate).map_err(|e| e.to_string())?;
  if !canonical.starts_with(&browser_root) {
    return Err("Artifact path escapes browser directory".to_string());
  }
  let bytes = fs::read(&canonical).map_err(|e| e.to_string())?;
  let mime_type = match canonical.extension().and_then(|e| e.to_str()) {
    Some("png") => "image/png",
    Some("jpg") | Some("jpeg") => "image/jpeg",
    Some("webp") => "image/webp",
    Some("json") => "application/json",
    _ => "application/octet-stream",
  }
  .to_string();
  Ok(BrowserArtifact {
    path: canonical.to_string_lossy().to_string(),
    mime_type,
    base64: base64::engine::general_purpose::STANDARD.encode(&bytes),
    size_bytes: bytes.len() as u64,
  })
}
