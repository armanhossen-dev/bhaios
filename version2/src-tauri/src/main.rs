#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;

struct SidecarState(Mutex<Option<Child>>);

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Supervise local FastAPI sidecar on 127.0.0.1:8765
            let child = Command::new("uvicorn")
                .args(["backend.server:app", "--host", "127.0.0.1", "--port", "8765"])
                .spawn()
                .ok();
            app.manage(SidecarState(Mutex::new(child)));
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(state) = window.try_state::<SidecarState>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(mut child) = guard.take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error running BhaiOS v2");
}
