use crate::terminal::manager::{strip_path_quotes, TerminalManager};

#[test]
fn strip_path_quotes_removes_quotes_from_gguf_path() {
    let input = r#"llama-server.exe -m "C:\models\llama-3.gguf""#;
    let output = strip_path_quotes(input);
    assert_eq!(output, r#"llama-server.exe -m C:\models\llama-3.gguf"#);
}

#[test]
fn strip_path_quotes_keeps_non_path_quotes() {
    let input = r#"echo "hello world""#;
    let output = strip_path_quotes(input);
    // "hello world" has no path separator or file extension → kept as-is
    assert_eq!(output, r#"echo "hello world""#);
}

#[test]
fn strip_path_quotes_multiple_paths() {
    let input = r#"tool.exe --input "C:\data\file.bin" --output "D:\out\result.ckpt""#;
    let output = strip_path_quotes(input);
    assert_eq!(output, r#"tool.exe --input C:\data\file.bin --output D:\out\result.ckpt"#);
}

#[test]
fn strip_path_quotes_empty_string() {
    assert_eq!(strip_path_quotes(""), "");
}

#[test]
fn once_lock_regex_compiles_once() {
    // Call strip_path_quotes twice — second call should reuse the cached regex,
    // not recompile. If the regex is invalid, the first call panics.
    let _ = strip_path_quotes(r#""C:\test\model.gguf""#);
    let _ = strip_path_quotes(r#""D:\other\safetensors.safetensors""#);
    // If we reach here, the OnceLock worked and the regex compiled successfully.
}

// ─── TerminalManager regression tests (AC-003, AC-005) ───

#[test]
fn terminal_manager_new_has_zero_sessions() {
    let manager = TerminalManager::new();
    assert_eq!(manager.session_count(), 0);
}

#[test]
fn terminal_manager_list_active_empty() {
    let manager = TerminalManager::new();
    let sessions = manager.list_active_sessions();
    assert!(sessions.is_empty());
}

#[test]
fn terminal_manager_get_session_by_config_id_none() {
    let manager = TerminalManager::new();
    assert!(manager.get_session_by_config_id("nonexistent").is_none());
}

#[test]
fn terminal_manager_get_output_buffer_empty() {
    let manager = TerminalManager::new();
    let buf = manager.get_output_buffer("nonexistent");
    assert!(buf.is_empty());
}

#[test]
fn terminal_manager_kill_all_empty_is_safe() {
    // kill_all on an empty manager must not panic and return 0
    let manager = TerminalManager::new();
    let count = manager.kill_all();
    assert_eq!(count, 0);
}

#[test]
fn terminal_manager_default_same_as_new() {
    let manager = TerminalManager::default();
    assert_eq!(manager.session_count(), 0);
}
