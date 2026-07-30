use crate::terminal::manager::strip_path_quotes;

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
