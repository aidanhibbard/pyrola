use keyring::Entry;

const SERVICE: &str = "pyrola";

fn entry(key: &str) -> Result<Entry, String> {
  Entry::new(SERVICE, key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_secret(key: String) -> Result<Option<String>, String> {
  match entry(&key)?.get_password() {
    Ok(value) => Ok(Some(value)),
    Err(keyring::Error::NoEntry) => Ok(None),
    Err(err) => Err(err.to_string()),
  }
}

#[tauri::command]
pub fn set_secret(key: String, value: String) -> Result<(), String> {
  entry(&key)?.set_password(&value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_secret(key: String) -> Result<(), String> {
  match entry(&key)?.delete_credential() {
    Ok(()) => Ok(()),
    Err(keyring::Error::NoEntry) => Ok(()),
    Err(err) => Err(err.to_string()),
  }
}
