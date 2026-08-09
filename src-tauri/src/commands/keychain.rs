use keyring::Entry;
use lazy_static::lazy_static;
use std::collections::HashMap;
use std::sync::Mutex;

const SERVICE: &str = "pyrola";
const KEY_PREFIX: &str = "pyrola:";
const VAULT_ACCOUNT: &str = "pyrola:vault";

type VaultMap = HashMap<String, String>;

struct VaultState {
  loaded: bool,
  map: VaultMap,
}

impl VaultState {
  fn empty() -> Self {
    Self {
      loaded: false,
      map: VaultMap::new(),
    }
  }
}

lazy_static! {
  static ref VAULT: Mutex<VaultState> = Mutex::new(VaultState::empty());
}

fn require_pyrola_key(key: &str) -> Result<(), String> {
  if !key.starts_with(KEY_PREFIX) {
    return Err("Keychain key must start with 'pyrola:'".to_string());
  }
  if key == VAULT_ACCOUNT {
    return Err("Keychain key cannot be the vault account".to_string());
  }
  Ok(())
}

fn map_keyring_error(err: keyring::Error) -> String {
  match err {
    keyring::Error::NoEntry => "No entry".to_string(),
    keyring::Error::PlatformFailure(inner) => {
      format!(
        "OS keychain unavailable ({inner}). On Linux, ensure a Secret Service provider (for example gnome-keyring) is running."
      )
    }
    keyring::Error::NoStorageAccess(inner) => {
      format!(
        "OS keychain access denied ({inner}). Unlock your system keyring or grant pyrola access."
      )
    }
    other => other.to_string(),
  }
}

fn vault_entry() -> Result<Entry, String> {
  Entry::new(SERVICE, VAULT_ACCOUNT).map_err(map_keyring_error)
}

fn legacy_entry(key: &str) -> Result<Entry, String> {
  Entry::new(SERVICE, key).map_err(map_keyring_error)
}

fn parse_vault(payload: &str) -> Result<VaultMap, String> {
  if payload.trim().is_empty() {
    return Ok(VaultMap::new());
  }
  let map: VaultMap = serde_json::from_str(payload)
    .map_err(|err| format!("Invalid keychain vault JSON ({err})"))?;
  if map.contains_key(VAULT_ACCOUNT) {
    return Err("Keychain vault must not contain the vault account key".to_string());
  }
  Ok(map)
}

fn serialize_vault(map: &VaultMap) -> Result<String, String> {
  serde_json::to_string(map).map_err(|err| format!("Failed to serialize keychain vault ({err})"))
}

/// Insert a legacy keychain value into the vault map if the key is not already present.
/// Returns the value that should be used for the key (existing vault value, or migrated).
fn merge_legacy_into_map(
  map: &mut VaultMap,
  key: &str,
  legacy_value: Option<String>,
) -> Option<String> {
  if let Some(existing) = map.get(key) {
    return Some(existing.clone());
  }
  let value = legacy_value?;
  map.insert(key.to_string(), value.clone());
  Some(value)
}

fn read_vault_from_os() -> Result<VaultMap, String> {
  match vault_entry()?.get_password() {
    Ok(payload) => parse_vault(&payload),
    Err(keyring::Error::NoEntry) => Ok(VaultMap::new()),
    Err(err) => Err(map_keyring_error(err)),
  }
}

fn write_vault_to_os(map: &VaultMap) -> Result<(), String> {
  let payload = serialize_vault(map)?;
  vault_entry()?
    .set_password(&payload)
    .map_err(map_keyring_error)
}

fn read_legacy_secret(key: &str) -> Result<Option<String>, String> {
  match legacy_entry(key)?.get_password() {
    Ok(value) => Ok(Some(value)),
    Err(keyring::Error::NoEntry) => Ok(None),
    Err(err) => Err(map_keyring_error(err)),
  }
}

fn delete_legacy_secret(key: &str) -> Result<(), String> {
  match legacy_entry(key)?.delete_credential() {
    Ok(()) => Ok(()),
    Err(keyring::Error::NoEntry) => Ok(()),
    Err(err) => Err(map_keyring_error(err)),
  }
}

fn ensure_vault_loaded(state: &mut VaultState) -> Result<(), String> {
  if state.loaded {
    return Ok(());
  }
  state.map = read_vault_from_os()?;
  state.loaded = true;
  Ok(())
}

fn persist_vault(state: &mut VaultState) -> Result<(), String> {
  write_vault_to_os(&state.map)?;
  state.loaded = true;
  Ok(())
}

fn migrate_legacy_into_vault(state: &mut VaultState, key: &str) -> Result<Option<String>, String> {
  let legacy = read_legacy_secret(key)?;
  let before_len = state.map.len();
  let value = merge_legacy_into_map(&mut state.map, key, legacy);
  if value.is_some() && state.map.len() > before_len {
    persist_vault(state)?;
    let _ = delete_legacy_secret(key);
  }
  Ok(value)
}

#[tauri::command]
pub fn get_secret(key: String) -> Result<Option<String>, String> {
  require_pyrola_key(&key)?;
  let mut state = VAULT
    .lock()
    .map_err(|_| "Keychain vault lock poisoned".to_string())?;
  ensure_vault_loaded(&mut state)?;
  if let Some(value) = state.map.get(&key) {
    return Ok(Some(value.clone()));
  }
  migrate_legacy_into_vault(&mut state, &key)
}

#[tauri::command]
pub fn set_secret(key: String, value: String) -> Result<(), String> {
  require_pyrola_key(&key)?;
  let mut state = VAULT
    .lock()
    .map_err(|_| "Keychain vault lock poisoned".to_string())?;
  ensure_vault_loaded(&mut state)?;
  state.map.insert(key.clone(), value);
  persist_vault(&mut state)?;
  let _ = delete_legacy_secret(&key);
  Ok(())
}

#[tauri::command]
pub fn delete_secret(key: String) -> Result<(), String> {
  require_pyrola_key(&key)?;
  let mut state = VAULT
    .lock()
    .map_err(|_| "Keychain vault lock poisoned".to_string())?;
  ensure_vault_loaded(&mut state)?;
  state.map.remove(&key);
  persist_vault(&mut state)?;
  let _ = delete_legacy_secret(&key);
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn parse_vault_empty_payload() {
    let map = parse_vault("").expect("empty vault");
    assert!(map.is_empty());
    let map = parse_vault("   ").expect("whitespace vault");
    assert!(map.is_empty());
  }

  #[test]
  fn parse_vault_round_trip() {
    let mut expected = VaultMap::new();
    expected.insert(
      "pyrola:provider:openai".to_string(),
      "sk-test".to_string(),
    );
    expected.insert(
      "pyrola:mcp:github:input:token".to_string(),
      "ghp_test".to_string(),
    );
    let payload = serialize_vault(&expected).expect("serialize");
    let parsed = parse_vault(&payload).expect("parse");
    assert_eq!(parsed, expected);
  }

  #[test]
  fn parse_vault_rejects_vault_account_key() {
    let payload = format!(r#"{{"{VAULT_ACCOUNT}":"nope"}}"#);
    let err = parse_vault(&payload).expect_err("vault account key");
    assert!(err.contains("must not contain the vault account key"));
  }

  #[test]
  fn parse_vault_rejects_invalid_json() {
    let err = parse_vault("{not-json").expect_err("invalid json");
    assert!(err.contains("Invalid keychain vault JSON"));
  }

  #[test]
  fn require_pyrola_key_rejects_prefix_and_vault_account() {
    assert!(require_pyrola_key("other:key").is_err());
    assert!(require_pyrola_key(VAULT_ACCOUNT).is_err());
    assert!(require_pyrola_key("pyrola:provider:openai").is_ok());
  }

  #[test]
  fn merge_legacy_prefers_existing_vault_value() {
    let mut map = VaultMap::new();
    map.insert(
      "pyrola:provider:openai".to_string(),
      "vault-value".to_string(),
    );
    let merged = merge_legacy_into_map(
      &mut map,
      "pyrola:provider:openai",
      Some("legacy-value".to_string()),
    );
    assert_eq!(merged.as_deref(), Some("vault-value"));
    assert_eq!(map.get("pyrola:provider:openai").map(String::as_str), Some("vault-value"));
  }

  #[test]
  fn merge_legacy_inserts_when_missing() {
    let mut map = VaultMap::new();
    let merged = merge_legacy_into_map(
      &mut map,
      "pyrola:provider:anthropic",
      Some("sk-legacy".to_string()),
    );
    assert_eq!(merged.as_deref(), Some("sk-legacy"));
    assert_eq!(
      map.get("pyrola:provider:anthropic").map(String::as_str),
      Some("sk-legacy")
    );
  }

  #[test]
  fn merge_legacy_returns_none_when_absent() {
    let mut map = VaultMap::new();
    let merged = merge_legacy_into_map(&mut map, "pyrola:provider:missing", None);
    assert!(merged.is_none());
    assert!(map.is_empty());
  }
}
