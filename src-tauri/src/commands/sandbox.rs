/// Generate a macOS Seatbelt profile for agent shell sandbox execution.
///
/// The profile uses parameter references substituted at runtime by sandbox-exec
/// via `-D KEY=VALUE` flags:
///   - `HOME`         - the user home directory
///   - `PROJECT_ROOT` - the project root (no trailing slash)
///   - `TMPDIR`       - the real (canonicalized) temp directory
///
/// Ancestor directories of `home` and `project_root` are emitted as literal
/// file-read allows so Node/npm `realpath`/`lstat` walks do not hit EPERM.
pub fn generate_seatbelt_profile(allow_network: bool, home: &str, project_root: &str) -> String {
  let network_rule = if allow_network {
    "(allow network*)\n"
  } else {
    ""
  };

  let ancestor_rules = format_ancestor_read_rules(home, project_root);

  format!(
    r#"(version 1)
(deny default)

; Process and signal operations required for shell execution
(allow process-exec)
(allow process-fork)
(allow process-exec-interpreter)
(allow signal)
(allow sysctl-read)
(allow mach-lookup)

; System read paths: binaries, libraries, and frameworks
; Modern macOS process startup needs root-directory read; subpath allows alone are insufficient.
(allow file-read* (literal "/"))
(allow file-read* (subpath "/usr"))
(allow file-read* (subpath "/bin"))
(allow file-read* (subpath "/sbin"))
(allow file-read* (subpath "/System"))
(allow file-read* (subpath "/Library"))
(allow file-read* (subpath "/Applications"))
(allow file-read* (subpath "/private/etc"))
(allow file-read* (subpath "/private/var/db/dyld"))
(allow file-read* (subpath "/private/var/folders"))
(allow file-read* (subpath "/private/var/select"))
; macOS symlink targets (var -> /private/var, etc -> /private/etc, tmp -> /private/tmp)
; Tools like cc/xcrun/xcode-select read /var/select/developer_dir; allow the symlink itself.
(allow file-read* (literal "/var"))
(allow file-read* (literal "/etc"))
(allow file-read* (literal "/tmp"))

; Temp directories (/tmp → /private/tmp on macOS)
(allow file-read*  (subpath "/private/tmp"))
(allow file-write* (subpath "/private/tmp"))
(allow file-read*  (subpath "/tmp"))
(allow file-write* (subpath "/tmp"))

; Device access
(allow file-read*  (subpath "/dev"))
(allow file-write* (literal "/dev/null"))
(allow file-ioctl  (subpath "/dev"))

; Common user tool prefixes (Homebrew, nix, etc.)
(allow file-read* (subpath "/opt/homebrew"))
(allow file-read* (subpath "/usr/local"))
(allow file-read* (subpath "/nix"))

; Ancestor directories of HOME and PROJECT_ROOT (Node/npm realpath walks lstat these)
{ancestor_rules}
; HOME: read allowed; write only for common tool cache dirs.
; More-specific deny rules below take precedence over broader allows.
(allow file-read*  (subpath (param "HOME")))
(allow file-write* (subpath (string-append (param "HOME") "/.npm")))
(allow file-write* (subpath (string-append (param "HOME") "/.cache")))
(allow file-write* (subpath (string-append (param "HOME") "/.cargo")))
(allow file-write* (subpath (string-append (param "HOME") "/.local")))
(allow file-write* (subpath (string-append (param "HOME") "/Library/Caches")))

; Deny sensitive credential directories inside HOME
(deny file-read*  (subpath (string-append (param "HOME") "/.ssh")))
(deny file-write* (subpath (string-append (param "HOME") "/.ssh")))
(deny file-read*  (subpath (string-append (param "HOME") "/.aws")))
(deny file-write* (subpath (string-append (param "HOME") "/.aws")))
(deny file-read*  (subpath (string-append (param "HOME") "/.gnupg")))
(deny file-write* (subpath (string-append (param "HOME") "/.gnupg")))

; Project root: full read/write access
(allow file-read*  (subpath (param "PROJECT_ROOT")))
(allow file-write* (subpath (param "PROJECT_ROOT")))

; Deny writes to .git/hooks to prevent hook injection attacks
(deny file-write* (subpath (string-append (param "PROJECT_ROOT") "/.git/hooks")))

; TMPDIR (macOS uses /private/var/folders/…/T by default)
(allow file-read*  (subpath (param "TMPDIR")))
(allow file-write* (subpath (param "TMPDIR")))

{network_rule}"#
  )
}

/// Ancestor directories of `path` from the parent up to (but not including) `/`.
/// Empty or relative paths yield no ancestors.
fn path_ancestors(path: &str) -> Vec<String> {
  let trimmed = path.trim().trim_end_matches('/');
  if trimmed.is_empty() || !trimmed.starts_with('/') {
    return Vec::new();
  }

  let mut ancestors = Vec::new();
  let mut current = trimmed.to_string();
  loop {
    let parent = match std::path::Path::new(&current).parent() {
      Some(p) => p.to_string_lossy().to_string(),
      None => break,
    };
    if parent.is_empty() || parent == "/" {
      break;
    }
    ancestors.push(parent.clone());
    current = parent;
  }
  ancestors
}

fn format_ancestor_read_rules(home: &str, project_root: &str) -> String {
  let mut seen = std::collections::BTreeSet::new();
  for path in [home, project_root] {
    for ancestor in path_ancestors(path) {
      seen.insert(ancestor);
    }
  }

  if seen.is_empty() {
    return String::new();
  }

  let mut out = String::new();
  for ancestor in seen {
    out.push_str(&format!(
      "(allow file-read* (literal \"{ancestor}\"))\n"
    ));
  }
  out
}

#[cfg(test)]
mod tests {
  use super::{generate_seatbelt_profile, path_ancestors};

  #[test]
  fn path_ancestors_home() {
    assert_eq!(
      path_ancestors("/Users/aidanhibbard"),
      vec!["/Users".to_string()]
    );
  }

  #[test]
  fn path_ancestors_project_root() {
    assert_eq!(
      path_ancestors("/Users/aidanhibbard/Documents/GitHub/pyrola"),
      vec![
        "/Users/aidanhibbard/Documents/GitHub".to_string(),
        "/Users/aidanhibbard/Documents".to_string(),
        "/Users/aidanhibbard".to_string(),
        "/Users".to_string(),
      ]
    );
  }

  #[test]
  fn path_ancestors_skips_relative_and_empty() {
    assert!(path_ancestors("").is_empty());
    assert!(path_ancestors("relative/path").is_empty());
    assert!(path_ancestors("/").is_empty());
  }

  #[test]
  fn profile_allows_root_directory_read() {
    let profile = generate_seatbelt_profile(false, "/Users/aidanhibbard", "/Users/aidanhibbard/proj");
    assert!(
      profile.contains("(allow file-read* (literal \"/\"))"),
      "profile must allow reading the filesystem root for modern macOS process startup"
    );
  }

  #[test]
  fn profile_allows_macos_symlink_reads() {
    let profile = generate_seatbelt_profile(false, "/Users/aidanhibbard", "/Users/aidanhibbard/proj");
    for path in ["/var", "/etc", "/tmp"] {
      let rule = format!("(allow file-read* (literal \"{path}\"))");
      assert!(
        profile.contains(&rule),
        "profile missing macOS symlink read rule: {rule}"
      );
    }
  }

  #[test]
  fn profile_includes_network_rule_when_enabled() {
    let with_network =
      generate_seatbelt_profile(true, "/Users/aidanhibbard", "/Users/aidanhibbard/proj");
    let without_network =
      generate_seatbelt_profile(false, "/Users/aidanhibbard", "/Users/aidanhibbard/proj");
    assert!(with_network.contains("(allow network*)"));
    assert!(!without_network.contains("(allow network*)"));
  }

  #[test]
  fn profile_allows_home_ancestors_read() {
    let profile =
      generate_seatbelt_profile(false, "/Users/aidanhibbard", "/Users/aidanhibbard/proj");
    assert!(
      profile.contains("(allow file-read* (literal \"/Users\"))"),
      "profile must allow reading HOME ancestors for Node/npm realpath"
    );
  }

  #[test]
  fn profile_allows_project_root_ancestors_read() {
    let profile = generate_seatbelt_profile(
      false,
      "/Users/aidanhibbard",
      "/Users/aidanhibbard/Documents/GitHub/pyrola",
    );
    for ancestor in [
      "/Users",
      "/Users/aidanhibbard",
      "/Users/aidanhibbard/Documents",
      "/Users/aidanhibbard/Documents/GitHub",
    ] {
      let rule = format!("(allow file-read* (literal \"{ancestor}\"))");
      assert!(
        profile.contains(&rule),
        "profile missing ancestor read rule: {rule}"
      );
    }
  }

  #[cfg(target_os = "macos")]
  #[test]
  fn sandbox_exec_echo_succeeds_with_profile() {
    use std::env;
    use std::process::Command;

    let home = env::var("HOME").unwrap_or_default();
    let tmpdir_raw = env::var("TMPDIR").unwrap_or_else(|_| "/tmp".to_string());
    let tmpdir = std::fs::canonicalize(&tmpdir_raw)
      .map(|p| p.to_string_lossy().to_string())
      .unwrap_or(tmpdir_raw);
    let project_root = env::current_dir()
      .expect("current dir")
      .to_string_lossy()
      .to_string();

    let profile = generate_seatbelt_profile(false, &home, &project_root);

    let output = Command::new("/usr/bin/sandbox-exec")
      .arg("-D")
      .arg(format!("HOME={home}"))
      .arg("-D")
      .arg(format!("PROJECT_ROOT={project_root}"))
      .arg("-D")
      .arg(format!("TMPDIR={tmpdir}"))
      .arg("-p")
      .arg(&profile)
      .arg("sh")
      .arg("-c")
      .arg("echo hello")
      .output()
      .expect("sandbox-exec spawn");

    assert!(
      output.status.success(),
      "sandbox-exec failed: status={} stderr={}",
      output.status,
      String::from_utf8_lossy(&output.stderr)
    );
    assert_eq!(String::from_utf8_lossy(&output.stdout).trim(), "hello");
  }

  #[cfg(target_os = "macos")]
  #[test]
  fn sandbox_cc_version_succeeds_with_profile() {
    use std::env;
    use std::process::Command;

    let home = env::var("HOME").unwrap_or_default();
    let tmpdir_raw = env::var("TMPDIR").unwrap_or_else(|_| "/tmp".to_string());
    let tmpdir = std::fs::canonicalize(&tmpdir_raw)
      .map(|p| p.to_string_lossy().to_string())
      .unwrap_or(tmpdir_raw);
    let project_root = env::current_dir()
      .expect("current dir")
      .to_string_lossy()
      .to_string();

    let profile = generate_seatbelt_profile(false, &home, &project_root);

    let output = Command::new("/usr/bin/sandbox-exec")
      .arg("-D")
      .arg(format!("HOME={home}"))
      .arg("-D")
      .arg(format!("PROJECT_ROOT={project_root}"))
      .arg("-D")
      .arg(format!("TMPDIR={tmpdir}"))
      .arg("-p")
      .arg(&profile)
      .arg("cc")
      .arg("--version")
      .output()
      .expect("sandbox-exec spawn");

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
      output.status.success(),
      "sandbox-exec cc --version failed: status={} stderr={}",
      output.status,
      stderr
    );
    assert!(
      stdout.to_lowercase().contains("clang"),
      "expected clang in cc --version stdout, got: {stdout}"
    );
  }
}
