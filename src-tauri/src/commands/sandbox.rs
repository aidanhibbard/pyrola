/// Generate a macOS Seatbelt profile for agent shell sandbox execution.
///
/// The profile uses parameter references substituted at runtime by sandbox-exec
/// via `-D KEY=VALUE` flags:
///   - `HOME`         - the user home directory
///   - `PROJECT_ROOT` - the project root (no trailing slash)
///   - `TMPDIR`       - the real (canonicalized) temp directory
pub fn generate_seatbelt_profile(allow_network: bool) -> String {
  let network_rule = if allow_network {
    "(allow network*)\n"
  } else {
    ""
  };

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

#[cfg(test)]
mod tests {
  use super::generate_seatbelt_profile;

  #[test]
  fn profile_allows_root_directory_read() {
    let profile = generate_seatbelt_profile(false);
    assert!(
      profile.contains("(allow file-read* (literal \"/\"))"),
      "profile must allow reading the filesystem root for modern macOS process startup"
    );
  }

  #[test]
  fn profile_includes_network_rule_when_enabled() {
    let with_network = generate_seatbelt_profile(true);
    let without_network = generate_seatbelt_profile(false);
    assert!(with_network.contains("(allow network*)"));
    assert!(!without_network.contains("(allow network*)"));
  }

  #[cfg(target_os = "macos")]
  #[test]
  fn sandbox_exec_echo_succeeds_with_profile() {
    use std::env;
    use std::process::Command;

    let profile = generate_seatbelt_profile(false);
    let home = env::var("HOME").unwrap_or_default();
    let tmpdir_raw = env::var("TMPDIR").unwrap_or_else(|_| "/tmp".to_string());
    let tmpdir = std::fs::canonicalize(&tmpdir_raw)
      .map(|p| p.to_string_lossy().to_string())
      .unwrap_or(tmpdir_raw);
    let project_root = env::current_dir()
      .expect("current dir")
      .to_string_lossy()
      .to_string();

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
}
