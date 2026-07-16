#[tauri::command]
pub fn reveal_in_folder(path: String) -> Result<(), String> {
  open::that_detached(path).map_err(|e| e.to_string())
}
