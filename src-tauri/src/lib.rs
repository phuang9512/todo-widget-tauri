use arboard::Clipboard;

/// WebView2 creates its profile under `%LOCALAPPDATA%\<identifier>`.
/// On some Windows setups the first launch fails with `os error 5` when that
/// parent directory does not exist yet, so create it before Tauri starts.
#[cfg(windows)]
fn ensure_windows_data_dir() {
    let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") else {
        return;
    };
    // Keep this in sync with `identifier` in `tauri.conf.json`.
    let dir = std::path::PathBuf::from(local_app_data).join("com.dsh.desktodo");
    if let Err(error) = std::fs::create_dir_all(&dir) {
        eprintln!(
            "failed to create app data directory {}: {error}",
            dir.display()
        );
    }
}

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
    #[cfg(windows)]
    ensure_windows_data_dir();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![write_clipboard])
        .run(tauri::generate_context!())
        .expect("error while running the todo app");
}
