use arboard::Clipboard;

/// Write plain text to the native system clipboard.
///
/// WebView clipboard access depends on secure-context/permission rules and can
/// fail silently on Windows WebView2. Routing copy through Rust gives the app
/// the same behaviour on Windows and macOS.
#[tauri::command]
fn write_clipboard(text: String) -> Result<(), String> {
    let mut clipboard =
        Clipboard::new().map_err(|error| format!("clipboard unavailable: {error}"))?;
    clipboard
        .set_text(text)
        .map_err(|error| format!("clipboard write failed: {error}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![write_clipboard])
        .run(tauri::generate_context!())
        .expect("error while running the todo app");
}
