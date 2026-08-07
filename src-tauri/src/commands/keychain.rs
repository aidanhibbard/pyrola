use keyring::Entry;

const SERVICE: &str = "pyrola";
const KEY_PREFIX: &str = "pyrola:";

fn require_pyrola_key(key: &str) -> Result<(), String> {
  if !key.starts_with(KEY_PREFIX) {
    return Err("Keychain key must start with 'pyrola:'".to_string());
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

fn entry(key: &str) -> Result<Entry, String> {
  require_pyrola_key(key)?;
  Entry::new(SERVICE, key).map_err(map_keyring_error)
}

#[tauri::command]
pub fn get_secret(key: String) -> Result<Option<String>, String> {
  match entry(&key)?.get_password() {
    Ok(value) => Ok(Some(value)),
    Err(keyring::Error::NoEntry) => Ok(None),
    Err(err) => Err(map_keyring_error(err)),
  }
}

#[tauri::command]
pub fn set_secret(key: String, value: String) -> Result<(), String> {
  entry(&key)?.set_password(&value).map_err(map_keyring_error)
}

#[tauri::command]
pub fn delete_secret(key: String) -> Result<(), String> {
  match entry(&key)?.delete_credential() {
    Ok(()) => Ok(()),
    Err(keyring::Error::NoEntry) => Ok(()),
    Err(err) => Err(map_keyring_error(err)),
  }
}
