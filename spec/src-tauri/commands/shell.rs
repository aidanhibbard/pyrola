use std::path::PathBuf;

use app_lib::commands::shell::is_reveal_path_allowed;

fn dummy_user_pyrola() -> PathBuf {
  PathBuf::from("/nonexistent-pyrola-user-dir")
}

#[test]
fn reveal_allows_path_under_pyrola_temp() {
  let dir = std::env::temp_dir().join("pyrola").join("screenshots");
  std::fs::create_dir_all(&dir).expect("create pyrola temp screenshots dir");
  let file = dir.join("reveal-allowlist-test.png");
  std::fs::write(&file, b"").expect("write temp screenshot fixture");
  let canonical = file.canonicalize().expect("canonicalize temp screenshot");
  assert!(is_reveal_path_allowed(
    &canonical,
    None,
    &dummy_user_pyrola(),
  ));
}

#[test]
fn reveal_rejects_path_under_etc() {
  let etc = PathBuf::from("/etc");
  let canonical = etc.canonicalize().unwrap_or(etc);
  assert!(!is_reveal_path_allowed(
    &canonical,
    None,
    &dummy_user_pyrola(),
  ));
}

#[test]
fn reveal_rejects_generic_temp_dir() {
  let temp = std::env::temp_dir();
  let canonical = temp.canonicalize().unwrap_or(temp);
  assert!(!is_reveal_path_allowed(
    &canonical,
    None,
    &dummy_user_pyrola(),
  ));
}
