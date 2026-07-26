use std::collections::{HashMap, VecDeque};
use std::io::{BufRead, BufReader};
use std::process::{Child, Stdio};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tauri::{Emitter, Manager};

/// Strip outer quotes from file path arguments in a command string.
///
/// When a command like `llama-server.exe -m "C:\path\model.gguf"` is passed
/// to `cmd /K` as a single argument, the inner quotes become literal characters
/// in the arguments received by the target process. This function removes those
/// quotes to prevent "Invalid argument" errors from the OS.
///
/// Only strips quotes from tokens that look like file paths (contain `\` or `/`
/// or end with a known file extension like `.gguf`, `.safetensors`, `.exe`, etc.).
fn strip_path_quotes(cmd: &str) -> String {
    let re = regex::Regex::new(r#""([^"]*[\./\\][^"]*\.(gguf|safetensors|exe|dll|so|dylib|mmproj|bin|model|ckpt|pt|bin2|pth))""#)
        .expect("valid regex");

    re.replace_all(cmd, |caps: &regex::Captures| {
        // Return the path without surrounding quotes (as owned String to avoid lifetime issues)
        caps[1].to_string()
    })
    .to_string()
}

/// Payload emitted on the "terminal-output" Tauri event.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalOutputEvent {
    pub session_id: String,
    pub text: String,
}

/// Circular buffer that keeps the last ~4 KB of terminal output.
/// Shared between the reader thread and the command thread.
pub struct OutputBuffer {
    inner: Arc<Mutex<VecDeque<char>>>,
    max_len: usize,
}

impl OutputBuffer {
    pub fn new(max_len: usize) -> Self {
        Self {
            inner: Arc::new(Mutex::new(VecDeque::new())),
            max_len,
        }
    }

    pub fn push(&self, text: &str) {
        let mut buf = self.inner.lock().unwrap();
        for c in text.chars() {
            buf.push_back(c);
            if buf.len() > self.max_len {
                buf.pop_front();
            }
        }
    }

    pub fn snapshot(&self) -> String {
        let buf = self.inner.lock().unwrap();
        buf.iter().collect()
    }

    /// Clone the Arc so the reader thread can share the same buffer.
    pub fn clone_arc(&self) -> Arc<Mutex<VecDeque<char>>> {
        self.inner.clone()
    }
}

unsafe impl Send for OutputBuffer {}
unsafe impl Sync for OutputBuffer {}

/// Represents an active terminal session using pipe-based I/O.
pub struct TerminalSession {
    pub child: Mutex<Child>,
    pub config_id: String,
    pub version_id: i64,
    pub output_buffer: OutputBuffer,
}

impl TerminalSession {
    pub fn is_alive(&self) -> bool {
        let mut child = self.child.lock().unwrap();
        child.try_wait().map(|s| s.is_none()).unwrap_or(false)
    }
}

/// Public info about an active terminal session (serializable to frontend).
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveTerminalInfo {
    pub session_id: String,
    pub config_id: String,
    pub version_id: i64,
}

/// Terminal manager that tracks active terminal sessions.
pub struct TerminalManager {
    sessions: Mutex<HashMap<String, TerminalSession>>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    /// Spawn a new terminal process with stdout/stderr redirected to pipes.
    /// Returns a session ID that can be used to interact with the terminal.
    pub fn spawn(
        &self,
        app: tauri::AppHandle,
        config_id: String,
        version_id: i64,
        working_dir: String,
        startup_command: Option<String>,
    ) -> Result<String, String> {
        let session_id = uuid::Uuid::new_v4().to_string();

        // Strip quotes from file path arguments to prevent "Invalid argument" errors.
        // When cmd /K receives a command with quoted paths, the quotes become literal
        // characters in the arguments passed to the target process.
        let clean_command = startup_command.as_ref().map(|sc| strip_path_quotes(sc));

        // Build the command to run
        let cmd_str = if let Some(sc) = &clean_command {
            // Escape cmd.exe metacharacters to prevent command injection / truncation
            let escaped = sc.replace('^', "^^")
                .replace('&', "^&")
                .replace('|', "^|")
                .replace('>', "^>")
                .replace('<', "^<")
                .replace('%', "^%")
                .replace('!', "^!");
            format!("cmd /K {}", escaped)
        } else {
            "cmd /K".to_string()
        };

        log::info!("[TERMINAL] Spawning process: version_id={} | config_id={} | cmd={} | dir={} | sessions_before={}",
            version_id, config_id, cmd_str, working_dir, self.session_count());

        // Spawn process with stdout/stderr redirected to pipes.
        // Use /C with "exit" to ensure cmd.exe exits after the command finishes.
        // Actually use /K to keep cmd alive, but pass command as separate arg.
        let mut cmd = std::process::Command::new("cmd");
        if let Some(sc) = &clean_command {
            if !sc.is_empty() {
                cmd.args(&["/K", sc]);
            } else {
                cmd.arg("/K");
            }
        } else {
            cmd.arg("/K");
        }
        let child = cmd
            .current_dir(&working_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn terminal process: {}", e))?;

        let pid = child.id();
        log::info!("[TERMINAL] Process spawned: session={} | pid={} | version_id={} | config_id={}",
            session_id, pid, version_id, config_id);

        // Store session with output buffer (4 KB circular buffer)
        let output_buffer = OutputBuffer::new(4096);
        let buffer_arc = output_buffer.clone_arc();

        let session = TerminalSession {
            child: Mutex::new(child),
            config_id: config_id.clone(),
            version_id,
            output_buffer,
        };

        self.sessions
            .lock()
            .map_err(|e| format!("Mutex poisoned: {}", e))?
            .insert(session_id.clone(), session);

        log::info!("[TERMINAL] sessions_after={}", self.session_count());

        // Spawn stdout reader task
        let app_handle = app.clone();
        let sid = session_id.clone();
        let stdout = {
            let sess = self.sessions.lock().unwrap();
            let x = sess.get(&sid).unwrap().child.lock().unwrap().stdout.take(); x
        };

        if let Some(stdout) = stdout {
            let app_handle = app_handle.clone();
            let sid = sid.clone();
            let buffer_arc = buffer_arc.clone();

            std::thread::spawn(move || {
                let log_msg = format!("[TERMINAL] stdout reader started for {}", sid);
                log::info!("{}", log_msg);
                let _ = app_handle.emit("terminal-debug", log_msg);

                let reader = BufReader::new(stdout);
                let mut read_count: u64 = 0;

                for line in reader.lines() {
                    match line {
                        Ok(text) => {
                            read_count += 1;
                            let with_newline = format!("{}\r\n", text);
                            let preview = with_newline.chars().take(120).collect::<String>();
                            let log_msg = format!("[TERMINAL] stdout read #{}: {} bytes: {:?}", read_count, with_newline.len(), preview);
                            log::info!("{}", log_msg);
                            let _ = app_handle.emit("terminal-debug", log_msg.clone());

                            // Store in circular buffer for late-joining viewers
                            {
                                let mut b = buffer_arc.lock().unwrap();
                                for c in with_newline.chars() {
                                    b.push_back(c);
                                    if b.len() > 4096 {
                                        b.pop_front();
                                    }
                                }
                            }

                            match app_handle.emit("terminal-output", TerminalOutputEvent {
                                session_id: sid.clone(),
                                text: with_newline.clone(),
                            }) {
                                Ok(()) => {
                                    let log_msg = format!("[TERMINAL] emit OK for {}", sid);
                                    log::info!("{}", log_msg);
                                    let _ = app_handle.emit("terminal-debug", log_msg);
                                }
                                Err(e) => {
                                    let log_msg = format!("[TERMINAL] emit FAILED for {}: {}", sid, e);
                                    log::error!("{}", log_msg);
                                    let _ = app_handle.emit("terminal-debug", log_msg);
                                }
                            }
                        }
                        Err(e) => {
                            let log_msg = format!("[TERMINAL] stdout read error after {} reads: {}", read_count, e);
                            log::warn!("{}", log_msg);
                            let _ = app_handle.emit("terminal-debug", log_msg);
                            break;
                        }
                    }
                }

                let log_msg = format!("[TERMINAL] stdout reader exiting for {} after {} reads", sid, read_count);
                log::info!("{}", log_msg);
                let _ = app_handle.emit("terminal-debug", log_msg);
            });
        }

        // Spawn stderr reader task
        let stderr = {
            let sess = self.sessions.lock().unwrap();
            let x = sess.get(&session_id).unwrap().child.lock().unwrap().stderr.take(); x
        };

        if let Some(stderr) = stderr {
            let app_handle = app.clone();
            let sid = session_id.clone();
            let buffer_arc = buffer_arc.clone();

            std::thread::spawn(move || {
                let log_msg = format!("[TERMINAL] stderr reader started for {}", sid);
                log::info!("{}", log_msg);
                let _ = app_handle.emit("terminal-debug", log_msg);

                let reader = BufReader::new(stderr);
                let mut read_count: u64 = 0;

                for line in reader.lines() {
                    match line {
                        Ok(text) => {
                            read_count += 1;
                            let with_newline = format!("\x1b[31m{}\x1b[0m\r\n", text);
                            let preview = with_newline.chars().take(120).collect::<String>();
                            let log_msg = format!("[TERMINAL] stderr read #{}: {} bytes: {:?}", read_count, with_newline.len(), preview);
                            log::info!("{}", log_msg);
                            let _ = app_handle.emit("terminal-debug", log_msg.clone());

                            // Store in circular buffer for late-joining viewers
                            {
                                let mut b = buffer_arc.lock().unwrap();
                                for c in with_newline.chars() {
                                    b.push_back(c);
                                    if b.len() > 4096 {
                                        b.pop_front();
                                    }
                                }
                            }

                            match app_handle.emit("terminal-output", TerminalOutputEvent {
                                session_id: sid.clone(),
                                text: with_newline.clone(),
                            }) {
                                Ok(()) => {
                                    let log_msg = format!("[TERMINAL] emit OK for {}", sid);
                                    log::info!("{}", log_msg);
                                    let _ = app_handle.emit("terminal-debug", log_msg);
                                }
                                Err(e) => {
                                    let log_msg = format!("[TERMINAL] emit FAILED for {}: {}", sid, e);
                                    log::error!("{}", log_msg);
                                    let _ = app_handle.emit("terminal-debug", log_msg);
                                }
                            }
                        }
                        Err(e) => {
                            let log_msg = format!("[TERMINAL] stderr read error after {} reads: {}", read_count, e);
                            log::warn!("{}", log_msg);
                            let _ = app_handle.emit("terminal-debug", log_msg);
                            break;
                        }
                    }
                }

                let log_msg = format!("[TERMINAL] stderr reader exiting for {} after {} reads", sid, read_count);
                log::info!("{}", log_msg);
                let _ = app_handle.emit("terminal-debug", log_msg);
            });
        }

        // Spawn process monitor: detect when process exits
        let app_handle = app.clone();
        let sid = session_id.clone();
        std::thread::spawn(move || {
            loop {
                std::thread::sleep(Duration::from_secs(1));
                let sessions = app_handle.state::<TerminalManager>();
                let alive = {
                    let sess = sessions.sessions.lock().unwrap();
                    if let Some(session) = sess.get(&sid) {
                        session.is_alive()
                    } else {
                        false
                    }
                };
                if !alive {
                    let log_msg = format!("[TERMINAL] process exited for {}", sid);
                    log::info!("{}", log_msg);
                    let _ = app_handle.emit("terminal-debug", log_msg);
                    let _ = app_handle.emit("terminal-exit", sid.clone());
                    break;
                }
            }
        });

        Ok(session_id)
    }

    /// Write input to a terminal session (not supported with pipe-based I/O).
    pub fn write_input(&self, _session_id: &str, _input: String) -> Result<(), String> {
        Err("Input writing is not supported with pipe-based terminal".to_string())
    }

    /// Kill a terminal session.
    pub fn kill(&self, session_id: &str) -> Result<String, String> {
        let session = {
            let mut sessions = self
                .sessions
                .lock()
                .map_err(|e| format!("Mutex poisoned: {}", e))?;

            sessions
                .remove(session_id)
                .ok_or_else(|| format!("Session not found: {}", session_id))?
        };

        let config_id = session.config_id.clone();

        // Terminate the process
        let mut child = session.child.lock().unwrap();
        child.kill()
            .map_err(|e| format!("Failed to kill terminal: {}", e))?;

        Ok(config_id)
    }

    /// Kill all terminal sessions (cleanup on app exit).
    pub fn kill_all(&self) {
        let sessions: Vec<_> = match self.sessions.lock() {
            Ok(mut s) => s.drain().map(|(_id, s)| s).collect(),
            Err(_) => return,
        };

        for session in sessions {
            if let Ok(mut child) = session.child.lock() {
                if let Err(e) = child.kill() {
                    log::warn!("Failed to kill terminal session: {}", e);
                }
            }
        }
    }

    /// Get the count of active sessions.
    pub fn session_count(&self) -> usize {
        match self.sessions.lock() {
            Ok(sessions) => sessions.len(),
            Err(_) => 0,
        }
    }

    /// List all active terminal sessions.
    pub fn list_active_sessions(&self) -> Vec<ActiveTerminalInfo> {
        match self.sessions.lock() {
            Ok(sessions) => sessions
                .iter()
                .map(|(session_id, session)| ActiveTerminalInfo {
                    session_id: session_id.clone(),
                    config_id: session.config_id.clone(),
                    version_id: session.version_id,
                })
                .collect(),
            Err(_) => Vec::new(),
        }
    }

    /// Get the session ID for a given config_id.
    /// Returns None if no active session for that config.
    pub fn get_session_by_config_id(&self, config_id: &str) -> Option<String> {
        match self.sessions.lock() {
            Ok(sessions) => sessions
                .iter()
                .find(|(_, session)| session.config_id == config_id)
                .map(|(session_id, _)| session_id.clone()),
            Err(_) => None,
        }
    }

    /// Get the buffered output for a session (for late-joining viewers).
    pub fn get_output_buffer(&self, session_id: &str) -> String {
        match self.sessions.lock() {
            Ok(sessions) => {
                if let Some(session) = sessions.get(session_id) {
                    session.output_buffer.snapshot()
                } else {
                    String::new()
                }
            }
            Err(_) => String::new(),
        }
    }

    /// Check if a session is still alive (process hasn't exited).
    pub fn is_session_alive(&self, session_id: &str) -> bool {
        match self.sessions.lock() {
            Ok(sessions) => sessions.contains_key(session_id),
            Err(_) => false,
        }
    }
}

impl Default for TerminalManager {
    fn default() -> Self {
        Self::new()
    }
}
