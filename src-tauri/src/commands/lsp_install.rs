use std::fs::{self, File};
use std::io::{copy, Write};
use std::path::{Path, PathBuf};
use std::process::Stdio;

use flate2::read::GzDecoder;
use tauri::{AppHandle, Emitter};
use tokio::process::Command as TokioCommand;
use tokio::sync::Mutex;

use super::lsp_registry::{
  builtin_spec_by_id, tier_a_ids, BuiltinLspSpec, GithubReleaseSpec, LspInstallKind, LspTier,
};
use super::paths::user_pyrola_dir;

lazy_static::lazy_static! {
  static ref INSTALL_LOCKS: Mutex<std::collections::HashMap<String, ()>> =
    Mutex::new(std::collections::HashMap::new());
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LspInstallProgress {
  pub server_id: String,
  pub state: String,
  pub message: Option<String>,
}

pub fn lsp_root(app: &AppHandle) -> Result<PathBuf, String> {
  let dir = user_pyrola_dir(app)?.join("lsp");
  fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  Ok(dir)
}

pub fn runtime_node_dir(app: &AppHandle) -> Result<PathBuf, String> {
  let dir = user_pyrola_dir(app)?.join("runtime").join("node");
  fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  Ok(dir)
}

pub fn managed_server_dir(app: &AppHandle, server_id: &str, version_key: &str) -> Result<PathBuf, String> {
  let dir = lsp_root(app)?.join(server_id).join(version_key);
  fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  Ok(dir)
}

pub fn auto_download_enabled(app: &AppHandle) -> bool {
  if std::env::var("PYROLA_DISABLE_LSP_DOWNLOAD")
    .map(|v| matches!(v.as_str(), "1" | "true" | "TRUE" | "yes"))
    .unwrap_or(false)
  {
    return false;
  }

  let Ok(settings) = super::config::read_settings_for_lsp(app) else {
    return true;
  };
  settings
    .get("lsp.autoDownload")
    .and_then(|v| v.as_bool())
    .unwrap_or(true)
}

fn emit_progress(app: &AppHandle, server_id: &str, state: &str, message: Option<String>) {
  let _ = app.emit(
    "lsp://install",
    LspInstallProgress {
      server_id: server_id.to_string(),
      state: state.to_string(),
      message,
    },
  );
}

pub fn host_asset_target() -> String {
  let arch = std::env::consts::ARCH;
  let os = std::env::consts::OS;
  match (os, arch) {
    ("macos", "aarch64") => "aarch64-apple-darwin".to_string(),
    ("macos", "x86_64") => "x86_64-apple-darwin".to_string(),
    ("linux", "aarch64") => "aarch64-unknown-linux-gnu".to_string(),
    ("linux", "x86_64") => "x86_64-unknown-linux-gnu".to_string(),
    ("windows", "x86_64") => "x86_64-pc-windows-msvc".to_string(),
    ("windows", "aarch64") => "aarch64-pc-windows-msvc".to_string(),
    _ => format!("{arch}-{os}"),
  }
}

fn node_dist_name() -> Result<String, String> {
  let version = "v22.14.0";
  match (std::env::consts::OS, std::env::consts::ARCH) {
    ("macos", "aarch64") => Ok(format!("node-{version}-darwin-arm64")),
    ("macos", "x86_64") => Ok(format!("node-{version}-darwin-x64")),
    ("linux", "aarch64") => Ok(format!("node-{version}-linux-arm64")),
    ("linux", "x86_64") => Ok(format!("node-{version}-linux-x64")),
    ("windows", "x86_64") => Ok(format!("node-{version}-win-x64")),
    _ => Err(format!(
      "Unsupported platform for portable Node: {} {}",
      std::env::consts::OS,
      std::env::consts::ARCH
    )),
  }
}

fn find_system_node() -> Option<PathBuf> {
  which::which("node").ok()
}

pub fn find_node_bin(app: &AppHandle) -> Option<PathBuf> {
  if let Some(system) = find_system_node() {
    return Some(system);
  }
  let dist = node_dist_name().ok()?;
  let runtime = runtime_node_dir(app).ok()?.join(dist);
  let node_bin = if cfg!(windows) {
    runtime.join("node.exe")
  } else {
    runtime.join("bin").join("node")
  };
  if node_bin.is_file() {
    Some(node_bin)
  } else {
    None
  }
}

pub async fn ensure_portable_node(app: &AppHandle) -> Result<PathBuf, String> {
  if let Some(system) = find_system_node() {
    return Ok(system);
  }

  let dist = node_dist_name()?;
  let runtime = runtime_node_dir(app)?.join(&dist);
  let node_bin = if cfg!(windows) {
    runtime.join("node.exe")
  } else {
    runtime.join("bin").join("node")
  };

  if node_bin.is_file() {
    return Ok(node_bin);
  }

  emit_progress(app, "node", "installing", Some("Downloading portable Node".into()));

  let archive_name = if cfg!(windows) {
    format!("{dist}.zip")
  } else {
    format!("{dist}.tar.gz")
  };
  let url = format!("https://nodejs.org/dist/v22.14.0/{archive_name}");
  let bytes = download_bytes(&url).await?;
  let parent = runtime_node_dir(app)?;

  if cfg!(windows) {
    extract_zip_bytes(&bytes, &parent)?;
  } else {
    extract_tar_gz_bytes(&bytes, &parent)?;
  }

  if !node_bin.is_file() {
    return Err("Portable Node download succeeded but binary missing".to_string());
  }

  #[cfg(unix)]
  {
    use std::os::unix::fs::PermissionsExt;
    let mut perms = fs::metadata(&node_bin)
      .map_err(|e| e.to_string())?
      .permissions();
    perms.set_mode(0o755);
    fs::set_permissions(&node_bin, perms).map_err(|e| e.to_string())?;
  }

  emit_progress(app, "node", "ready", None);
  Ok(node_bin)
}

async fn download_bytes(url: &str) -> Result<Vec<u8>, String> {
  let client = reqwest::Client::builder()
    .user_agent("pyrola-lsp-installer")
    .build()
    .map_err(|e| e.to_string())?;
  let response = client
    .get(url)
    .send()
    .await
    .map_err(|e| e.to_string())?;
  if !response.status().is_success() {
    return Err(format!("Download failed ({}) for {url}", response.status()));
  }
  response.bytes().await.map(|b| b.to_vec()).map_err(|e| e.to_string())
}

fn extract_tar_gz_bytes(bytes: &[u8], dest: &Path) -> Result<(), String> {
  let decoder = GzDecoder::new(bytes);
  let mut archive = tar::Archive::new(decoder);
  archive.unpack(dest).map_err(|e| e.to_string())
}

fn extract_zip_bytes(bytes: &[u8], dest: &Path) -> Result<(), String> {
  // Minimal zip extract without zip crate: write temp and use system unzip when needed.
  // Prefer writing a .zip and extracting with `tar`/`Expand-Archive` via std process.
  let tmp = dest.join(".download.zip");
  {
    let mut file = File::create(&tmp).map_err(|e| e.to_string())?;
    file.write_all(bytes).map_err(|e| e.to_string())?;
  }
  #[cfg(windows)]
  {
    let status = std::process::Command::new("powershell")
      .args([
        "-NoProfile",
        "-Command",
        &format!(
          "Expand-Archive -Path '{}' -DestinationPath '{}' -Force",
          tmp.display(),
          dest.display()
        ),
      ])
      .status()
      .map_err(|e| e.to_string())?;
    let _ = fs::remove_file(&tmp);
    if !status.success() {
      return Err("Failed to extract zip archive".to_string());
    }
    return Ok(());
  }
  #[cfg(not(windows))]
  {
    let status = std::process::Command::new("unzip")
      .args(["-o", "-q", &tmp.to_string_lossy(), "-d", &dest.to_string_lossy()])
      .status()
      .map_err(|e| e.to_string())?;
    let _ = fs::remove_file(&tmp);
    if !status.success() {
      return Err("Failed to extract zip archive (install unzip)".to_string());
    }
    Ok(())
  }
}

fn write_gzip_file(bytes: &[u8], dest: &Path) -> Result<(), String> {
  let mut decoder = GzDecoder::new(bytes);
  let mut out = File::create(dest).map_err(|e| e.to_string())?;
  copy(&mut decoder, &mut out).map_err(|e| e.to_string())?;
  #[cfg(unix)]
  {
    use std::os::unix::fs::PermissionsExt;
    let mut perms = fs::metadata(dest).map_err(|e| e.to_string())?.permissions();
    perms.set_mode(0o755);
    fs::set_permissions(dest, perms).map_err(|e| e.to_string())?;
  }
  Ok(())
}

fn version_key_for_spec(spec: &BuiltinLspSpec) -> String {
  match spec.install {
    LspInstallKind::Npm => spec
      .npm
      .as_ref()
      .map(|n| n.packages.join("+"))
      .unwrap_or_else(|| "latest".to_string())
      .replace(['@', '/', ':'], "_"),
    LspInstallKind::GithubRelease => spec
      .github
      .as_ref()
      .map(|g| format!("{}_{}", g.tag.replace('/', "_"), host_asset_target()))
      .unwrap_or_else(|| "latest".to_string()),
    _ => "path".to_string(),
  }
}

pub fn managed_bin_path(app: &AppHandle, spec: &BuiltinLspSpec) -> Option<PathBuf> {
  let key = version_key_for_spec(spec);
  let dir = managed_server_dir(app, spec.id, &key).ok()?;
  match spec.install {
    LspInstallKind::Npm => {
      let npm = spec.npm.as_ref()?;
      let candidate = dir.join(npm.bin);
      if candidate.is_file() {
        Some(candidate)
      } else {
        None
      }
    }
    LspInstallKind::GithubRelease => {
      let github = spec.github.as_ref()?;
      let candidate = dir.join(github.binary_name);
      if candidate.is_file() {
        Some(candidate)
      } else {
        // Some archives nest under a top folder
        let nested = dir.join(github.binary_name.rsplit('/').next().unwrap_or(github.binary_name));
        if nested.is_file() {
          Some(nested)
        } else {
          find_file_named(&dir, Path::new(github.binary_name).file_name()?.to_str()?)
        }
      }
    }
    _ => None,
  }
}

fn find_file_named(dir: &Path, name: &str) -> Option<PathBuf> {
  let mut stack = vec![dir.to_path_buf()];
  while let Some(current) = stack.pop() {
    let entries = fs::read_dir(&current).ok()?;
    for entry in entries.flatten() {
      let path = entry.path();
      if path.is_dir() {
        stack.push(path);
      } else if path.file_name().and_then(|n| n.to_str()) == Some(name) {
        return Some(path);
      }
    }
  }
  None
}

#[allow(dead_code)]
pub fn is_installed(app: &AppHandle, spec: &BuiltinLspSpec) -> bool {
  match spec.install {
    LspInstallKind::Npm | LspInstallKind::GithubRelease => managed_bin_path(app, spec).is_some(),
    LspInstallKind::ToolchainPath => which::which(spec.command.first().copied().unwrap_or("")).is_ok(),
    LspInstallKind::None => false,
  }
}

async fn npm_install_packages(app: &AppHandle, spec: &BuiltinLspSpec) -> Result<PathBuf, String> {
  let npm = spec
    .npm
    .as_ref()
    .ok_or_else(|| format!("Server {} has no npm install spec", spec.id))?;
  let key = version_key_for_spec(spec);
  let dir = managed_server_dir(app, spec.id, &key)?;
  let marker = dir.join(".installed");
  if marker.is_file() && managed_bin_path(app, spec).is_some() {
    return managed_bin_path(app, spec).ok_or_else(|| "Managed bin missing".to_string());
  }

  let node = ensure_portable_node(app).await?;
  let npm_cli = node
    .parent()
    .map(|p| {
      if cfg!(windows) {
        p.join("npm.cmd")
      } else {
        // Portable node layout: bin/node, npm may be sibling or via node + npm package
        p.join("npm")
      }
    })
    .filter(|p| p.exists());

  emit_progress(
    app,
    spec.id,
    "installing",
    Some(format!("Installing {}", spec.id)),
  );

  // Prefer `node /path/to/npm` style via corepack/npm from PATH, else node -e with npx-like install
  let status = if let Some(npm_bin) = npm_cli {
    TokioCommand::new(npm_bin)
      .args(
        [
          vec![
            "install".to_string(),
            "--prefix".to_string(),
            dir.to_string_lossy().to_string(),
            "--no-fund".to_string(),
            "--no-audit".to_string(),
          ],
          npm.packages.iter().map(|p| (*p).to_string()).collect(),
        ]
        .concat(),
      )
      .stdout(Stdio::null())
      .stderr(Stdio::piped())
      .status()
      .await
      .map_err(|e| e.to_string())?
  } else if let Ok(system_npm) = which::which("npm") {
    TokioCommand::new(system_npm)
      .args(
        [
          vec![
            "install".to_string(),
            "--prefix".to_string(),
            dir.to_string_lossy().to_string(),
            "--no-fund".to_string(),
            "--no-audit".to_string(),
          ],
          npm.packages.iter().map(|p| (*p).to_string()).collect(),
        ]
        .concat(),
      )
      .stdout(Stdio::null())
      .stderr(Stdio::piped())
      .status()
      .await
      .map_err(|e| e.to_string())?
  } else {
    // Bootstrap: download packages using node + built-in fetch via a tiny install script is heavy.
    // Fall back: require npm on PATH for first install after portable node without npm.
    return Err(
      "npm is required to install language servers. Install Node.js (includes npm) or ensure npm is on PATH."
        .to_string(),
    );
  };

  if !status.success() {
    return Err(format!("npm install failed for {}", spec.id));
  }

  fs::write(&marker, b"ok").map_err(|e| e.to_string())?;
  managed_bin_path(app, spec).ok_or_else(|| format!("Installed {} but bin missing", spec.id))
}

fn resolve_github_asset(spec: &GithubReleaseSpec) -> Result<(String, String), String> {
  let target = host_asset_target();
  let mut asset = spec.asset.replace("{target}", &target);
  asset = asset.replace("{version}", spec.tag.trim_start_matches('v'));

  // Common alternate names
  let alt_target = match target.as_str() {
    "aarch64-apple-darwin" => "darwin-arm64",
    "x86_64-apple-darwin" => "darwin-x64",
    "x86_64-unknown-linux-gnu" => "linux-x64",
    "aarch64-unknown-linux-gnu" => "linux-arm64",
    "x86_64-pc-windows-msvc" => "windows-x64",
    other => other,
  };
  if !asset.contains(&target) {
    asset = spec.asset.replace("{target}", alt_target);
  }

  let url = format!(
    "https://github.com/{}/releases/download/{}/{}",
    spec.repo, spec.tag, asset
  );
  Ok((url, asset))
}

async fn github_install(app: &AppHandle, spec: &BuiltinLspSpec) -> Result<PathBuf, String> {
  let github = spec
    .github
    .as_ref()
    .ok_or_else(|| format!("Server {} has no github install spec", spec.id))?;
  let key = version_key_for_spec(spec);
  let dir = managed_server_dir(app, spec.id, &key)?;
  if let Some(existing) = managed_bin_path(app, spec) {
    return Ok(existing);
  }

  emit_progress(
    app,
    spec.id,
    "installing",
    Some(format!("Downloading {}", spec.id)),
  );

  let (url, _asset) = resolve_github_asset(github)?;
  let bytes = download_bytes(&url).await.map_err(|e| {
    format!(
      "Failed to download {} from GitHub ({e}). Falling back to PATH if available.",
      spec.id
    )
  })?;

  let dest_name = Path::new(github.binary_name)
    .file_name()
    .and_then(|n| n.to_str())
    .unwrap_or(github.binary_name);
  let dest = dir.join(dest_name);

  if github.gzip || url.ends_with(".gz") && !url.ends_with(".tar.gz") {
    write_gzip_file(&bytes, &dest)?;
  } else if url.ends_with(".tar.gz") || url.ends_with(".tgz") {
    extract_tar_gz_bytes(&bytes, &dir)?;
  } else if url.ends_with(".zip") {
    extract_zip_bytes(&bytes, &dir)?;
  } else {
    fs::write(&dest, &bytes).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
      use std::os::unix::fs::PermissionsExt;
      let mut perms = fs::metadata(&dest).map_err(|e| e.to_string())?.permissions();
      perms.set_mode(0o755);
      fs::set_permissions(&dest, perms).map_err(|e| e.to_string())?;
    }
  }

  managed_bin_path(app, spec).ok_or_else(|| format!("Downloaded {} but binary missing", spec.id))
}

pub async fn ensure_server_installed(
  app: &AppHandle,
  server_id: &str,
) -> Result<Option<PathBuf>, String> {
  let Some(spec) = builtin_spec_by_id(server_id) else {
    return Ok(None);
  };

  if !auto_download_enabled(app) {
    return Ok(managed_bin_path(app, spec));
  }

  if spec.tier == LspTier::D || spec.install == LspInstallKind::None {
    return Ok(None);
  }

  if spec.install == LspInstallKind::ToolchainPath {
    let bin = spec.command.first().copied().unwrap_or("");
    return Ok(which::which(bin).ok());
  }

  {
    let mut locks = INSTALL_LOCKS.lock().await;
    if locks.contains_key(server_id) {
      // another install in progress; fall through after release
    }
    locks.insert(server_id.to_string(), ());
  }

  let result = match spec.install {
    LspInstallKind::Npm => npm_install_packages(app, spec).await.map(Some),
    LspInstallKind::GithubRelease => match github_install(app, spec).await {
      Ok(path) => Ok(Some(path)),
      Err(error) => {
        // Allow PATH fallback
        let fallback = which::which(spec.command.first().copied().unwrap_or("")).ok();
        if fallback.is_some() {
          emit_progress(app, server_id, "path", Some(error));
          Ok(fallback)
        } else {
          Err(error)
        }
      }
    },
    _ => Ok(None),
  };

  INSTALL_LOCKS.lock().await.remove(server_id);

  match &result {
    Ok(Some(_)) => emit_progress(app, server_id, "ready", None),
    Ok(None) => {}
    Err(error) => emit_progress(app, server_id, "error", Some(error.clone())),
  }

  result
}

pub async fn prefetch_tier_a(app: AppHandle) -> Result<(), String> {
  if !auto_download_enabled(&app) {
    return Ok(());
  }

  emit_progress(&app, "*", "installing", Some("Installing language support…".into()));

  // Ensure node once up front for npm servers
  let _ = ensure_portable_node(&app).await;

  for id in tier_a_ids() {
    match ensure_server_installed(&app, id).await {
      Ok(_) => {}
      Err(error) => {
        log::warn!("LSP prefetch failed for {id}: {error}");
        emit_progress(&app, id, "error", Some(error));
      }
    }
  }

  emit_progress(&app, "*", "ready", Some("Language support ready".into()));
  Ok(())
}

#[tauri::command]
pub async fn lsp_prefetch_defaults(app: AppHandle) -> Result<(), String> {
  tokio::spawn(async move {
    let _ = prefetch_tier_a(app).await;
  });
  Ok(())
}

#[tauri::command]
pub async fn lsp_install_server(app: AppHandle, server_id: String) -> Result<(), String> {
  ensure_server_installed(&app, &server_id).await?;
  Ok(())
}

pub fn managed_vue_plugin_path(app: &AppHandle) -> Option<PathBuf> {
  let spec = builtin_spec_by_id("vue")?;
  let key = version_key_for_spec(spec);
  let dir = managed_server_dir(app, "vue", &key).ok()?;
  let plugin = dir.join("node_modules/@vue/typescript-plugin");
  if plugin.is_dir() {
    Some(plugin)
  } else {
    None
  }
}

pub fn managed_typescript_lib(app: &AppHandle) -> Option<PathBuf> {
  let spec = builtin_spec_by_id("typescript")?;
  let key = version_key_for_spec(spec);
  let dir = managed_server_dir(app, "typescript", &key).ok()?;
  let lib = dir.join("node_modules/typescript/lib");
  if lib.is_dir() {
    Some(lib)
  } else {
    None
  }
}

pub fn install_source_label(app: &AppHandle, server_id: &str) -> String {
  let Some(spec) = builtin_spec_by_id(server_id) else {
    return "none".to_string();
  };
  if managed_bin_path(app, spec).is_some() {
    return "managed".to_string();
  }
  if which::which(spec.command.first().copied().unwrap_or("")).is_ok() {
    return "path".to_string();
  }
  "none".to_string()
}
