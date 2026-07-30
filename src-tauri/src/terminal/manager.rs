use std::collections::{HashMap, VecDeque};
use std::io::{BufRead, BufReader};
use std::process::{Child, Stdio};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use tauri::{Emitter, Manager};

/// Regex pattern compiled once at first use (lazy, thread-safe).
/// Strips outer quotes from file path arguments to prevent "Invalid argument"
/// errors when `cmd /K` passes quoted paths as literal characters.
static PATH_QUOTE_RE: OnceLock<regex::Regex> = OnceLock::new();

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
    let re = PATH_QUOTE_RE.get_or_init(|| {
        regex::Regex::new(r#""([^"]*[\./\\][^"]*\.(gguf|safetensors|exe|dll|so|dylib|mmproj|bin|model|ckpt|pt|bin2|pth))""#)
            .expect("valid regex")
    });

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
}

impl OutputBuffer {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(VecDeque::new())),
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

/// Spawn a thread that reads lines from a stream (stdout or stderr),
/// stores them in the circular buffer, and emits Tauri events.
///
/// Both `ChildStdout` and `ChildStderr` implement `Read + Send`, so this
/// generic function handles both streams without code duplication.
fn spawn_reader_thread<R: std::io::Read + Send + 'static>(
    stream: R,
    stream_name: String,
    session_id: String,
    app_handle: tauri::AppHandle,
    buffer_arc: Arc<Mutex<VecDeque<char>>>,
    is_stderr: bool,
) {
    std::thread::spawn(move || {
        log::info!("[TERMINAL] {} reader started for {}", stream_name, session_id);

        let reader = BufReader::new(stream);
        let mut read_count: u64 = 0;

        for line in reader.lines() {
            match line {
                Ok(text) => {
                    read_count += 1;
                    let with_newline = if is_stderr {
                        format!("\x1b[31m{}\x1b[0m\r\n", text)
                    } else {
                        format!("{}\r\n", text)
                    };

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
                        session_id: session_id.clone(),
                        text: with_newline.clone(),
                    }) {
                        Ok(()) => {}
                        Err(e) => {
                            log::error!("[TERMINAL] emit FAILED for {}: {}", session_id, e);
                        }
                    }
                }
                Err(e) => {
                    log::warn!("[TERMINAL] {} read error after {} reads: {}", stream_name, read_count, e);
                    break;
                }
            }
        }

        log::info!("[TERMINAL] {} reader exiting for {} after {} reads", stream_name, session_id, read_count);
    });
}

/// Represents an active terminal session using pipe-based I/O.
pub struct TerminalSession {
    pub child: Mutex<Child>,
    pub pid: u32,
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
                cmd.args(["/K", sc]);
            } else {
                cmd.arg("/K");
            }
        } else {
            cmd.arg("/K");
        }

        // On Windows, use CREATE_NO_WINDOW to prevent cmd.exe from
        // spawning a visible console window (output goes to our pipes instead).
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
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
        let output_buffer = OutputBuffer::new();
        let buffer_arc = output_buffer.clone_arc();

        let session = TerminalSession {
            child: Mutex::new(child),
            pid,
            config_id: config_id.clone(),
            version_id,
            output_buffer,
        };

        self.sessions
            .lock()
            .map_err(|e| format!("Mutex poisoned: {}", e))?
            .insert(session_id.clone(), session);

        log::info!("[TERMINAL] sessions_after={}", self.session_count());

        // Take stdout/stderr pipes from the stored session before spawning reader threads.
        let (stdout, stderr) = {
            let sess = self.sessions.lock().unwrap();
            let s = sess.get(&session_id).unwrap();
            let mut child = s.child.lock().unwrap();
            (child.stdout.take(), child.stderr.take())
        };

        // Spawn stdout reader thread
        if let Some(stdout) = stdout {
            spawn_reader_thread(stdout, "stdout".to_string(), session_id.clone(), app.clone(), buffer_arc.clone(), false);
        }

        // Spawn stderr reader thread
        if let Some(stderr) = stderr {
            spawn_reader_thread(stderr, "stderr".to_string(), session_id.clone(), app.clone(), buffer_arc.clone(), true);
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
                    let _ = app_handle.emit("terminal-exit", sid.clone());
                    break;
                }
            }
        });

        Ok(session_id)
    }

    /// Kill a terminal session and ALL its child processes (including llama-server.exe).
    ///
    /// On Windows, calling child.kill() on cmd.exe does NOT terminate child processes
    /// like llama-server.exe. They survive as orphan processes.
    /// We use `taskkill /T /F /PID` to forcefully kill the entire process tree.
    ///
    /// Runs taskkill synchronously. Tauri IPC commands already execute on a separate
    /// thread, so blocking briefly for taskkill does not freeze the UI. This avoids
    /// panics when the Tokio runtime has been dropped (e.g. during app shutdown).
    pub fn kill(&self, app: tauri::AppHandle, session_id: &str) -> Result<String, String> {
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
        let pid = session.pid;

        log::info!("[TERMINAL] Killing process tree: session={} | pid={}", session_id, pid);

        // Use taskkill /T /F to kill the entire process tree (cmd.exe + all children like llama-server.exe)
        // /T = kill child processes tree
        // /F = force termination
        match std::process::Command::new("taskkill")
            .args(["/T", "/F", "/PID", &pid.to_string()])
            .output()
        {
            Ok(output) if output.status.success() => {
                log::info!("[TERMINAL] Process tree killed successfully: session={} | pid={}", session_id, pid);
            }
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                log::warn!("[TERMINAL] taskkill returned non-zero: session={} | pid={} | stderr={}",
                    session_id, pid, stderr);
            }
            Err(e) => {
                // Process may have already exited — not a critical error
                log::warn!("[TERMINAL] Failed to execute taskkill for PID {}: {} (process may have already exited)", pid, e);
            }
        }

        // Small delay to let the OS finish cleaning up the process tree
        std::thread::sleep(std::time::Duration::from_millis(200));

        // Emit terminal-exit event so the frontend can clear the "Stopping..." status
        let _ = app.emit("terminal-exit", session_id.to_string());

        Ok(config_id)
    }

    /// Kill all terminal sessions and their child processes (cleanup on app exit).
    /// Runs taskkill synchronously since this is only called during app shutdown
    /// where blocking the main thread is acceptable.
    /// Returns the number of sessions that were killed.
    pub fn kill_all(&self) -> usize {
        let sessions: Vec<_> = match self.sessions.lock() {
            Ok(mut s) => s.drain().map(|(_id, s)| s).collect(),
            Err(_) => return 0,
        };

        let count = sessions.len();
        log::info!("[TERMINAL] kill_all: killing {} session(s)", count);

        for session in sessions {
            let pid = session.pid;
            log::info!("[TERMINAL] kill_all: killing process tree pid={}", pid);

            // Use taskkill /T /F to kill the entire process tree
            if let Err(e) = std::process::Command::new("taskkill")
                .args(["/T", "/F", "/PID", &pid.to_string()])
                .output()
            {
                log::warn!("[TERMINAL] kill_all: failed to execute taskkill for PID {}: {}", pid, e);
            }
        }

        count
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

}

impl Default for TerminalManager {
    fn default() -> Self {
        Self::new()
    }
}
