use std::collections::{HashMap, VecDeque};
use std::io::Read;
use std::os::windows::process::CommandExt;
use std::process::{Child, Stdio};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use tauri::{Emitter, Manager};

/// Unsafe wrapper allowing `std::process::Child` to be shared across threads.
/// Child is !Send/!Sync in some Rust versions conservatively, but on Windows
/// the underlying process handle is safe to access from multiple threads.
pub(crate) struct UnsafeChild(Child);

unsafe impl Send for UnsafeChild {}
unsafe impl Sync for UnsafeChild {}

/// Regex pattern compiled once at first use (lazy, thread-safe).
/// Strips outer quotes from file path arguments to prevent "Invalid argument"
/// errors when passing quoted paths as literal characters.
pub(crate) static PATH_QUOTE_RE: OnceLock<regex::Regex> = OnceLock::new();

/// Strip outer quotes from file path arguments in a command string.
///
/// When a command like `llama-server.exe -m "C:\path\model.gguf"` is passed
/// to `cmd /K` as a single argument, the inner quotes become literal characters
/// in the arguments received by the target process. This function removes those
/// quotes to prevent "Invalid argument" errors from the OS.
///
/// Only strips quotes from tokens that look like file paths (contain `\` or `/`
/// or end with a known file extension like `.gguf`, `.safetensors`, `.exe`, etc.).
pub(crate) fn strip_path_quotes(cmd: &str) -> String {
    let re = PATH_QUOTE_RE.get_or_init(|| {
        regex::Regex::new(r#""([^"]*[\./\\][^"]*\.(gguf|safetensors|exe|dll|so|dylib|mmproj|bin|model|ckpt|pt|bin2|pth))""#)
            .expect("valid regex")
    });

    re.replace_all(cmd, |caps: &regex::Captures| {
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

/// Reason a terminal session ended, carried in the "terminal-exit" event payload.
/// "killed" = user-initiated stop; "exited" = unexpected process termination (crash).
#[derive(Clone, Copy, serde::Serialize)]
pub enum TerminalExitReason {
    #[serde(rename = "killed")]
    Killed,
    #[serde(rename = "exited")]
    Exited,
}

/// Payload emitted on the "terminal-exit" Tauri event.
/// Carries both the session ID and the exit reason so the frontend can distinguish
/// intentional stops from unexpected crashes without relying on a second event.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalExitEvent {
    pub session_id: String,
    pub reason: TerminalExitReason,
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

/// Spawn a thread that reads raw bytes from a stdio pipe (stdout or stderr),
/// stores them in the circular buffer, and emits Tauri events.
///
/// Uses `read()` instead of `BufRead::lines()` to preserve ANSI escape sequences
/// and avoid line-buffering truncation of long output lines.
fn spawn_stdio_reader(
    mut stream: impl Read + Send + 'static,
    stream_name: String,
    session_id: String,
    app_handle: tauri::AppHandle,
    buffer_arc: Arc<Mutex<VecDeque<char>>>,
) {
    std::thread::spawn(move || {
        log::trace!("[TERMINAL] {} reader started for {}", stream_name, session_id);

        let mut buf = [0u8; 4096];
        let mut read_count: u64 = 0;

        loop {
            match stream.read(&mut buf) {
                Ok(0) => {
                    // EOF — process closed this pipe
                    log::info!("[TERMINAL] {} EOF after {} reads", stream_name, read_count);
                    break;
                }
                Ok(n) => {
                    read_count += 1;
                    // from_utf8_lossy preserves all bytes (replacing invalid UTF-8 with �)
                    // while producing a valid String for xterm.js.
                    let text = String::from_utf8_lossy(&buf[..n]).to_string();

                    log::trace!(
                        "[TERMINAL] {} read #{} for {}: bytes={}",
                        stream_name, read_count, session_id, text.len()
                    );

                    if text.is_empty() {
                        continue;
                    }

                    // Store in circular buffer for late-joining viewers
                    {
                        let mut b = buffer_arc.lock().unwrap();
                        for c in text.chars() {
                            b.push_back(c);
                            if b.len() > 4096 {
                                b.pop_front();
                            }
                        }
                    }

                    match app_handle.emit("terminal-output", TerminalOutputEvent {
                        session_id: session_id.clone(),
                        text,
                    }) {
                        Ok(()) => {}
                        Err(e) => {
                            log::error!("[TERMINAL] emit FAILED for {}: {}", session_id, e);
                        }
                    }
                }
                Err(e) => {
                    // Pipe read error — log and exit (unlike ConPTY, piped stdio
                    // errors are genuine failures, not normal pipe lifecycle)
                    let code = e.raw_os_error();
                    log::warn!(
                        "[TERMINAL] {} read error for {}: {} (raw_os={:?})",
                        stream_name, session_id, e, code
                    );
                    break;
                }
            }
        }

        log::info!(
            "[TERMINAL] {} reader exited for {} after {} reads",
            stream_name, session_id, read_count
        );
    });
}

/// Represents an active terminal session using std::process with piped stdio.
pub struct TerminalSession {
    pub process: Arc<Mutex<UnsafeChild>>,
    pub pid: u32,
    pub config_id: String,
    pub version_id: i64,
    pub output_buffer: OutputBuffer,
}

impl TerminalSession {
    pub fn is_alive(&self) -> bool {
        let mut proc = self.process.lock().unwrap();
        proc.0.try_wait().map(|r| r.is_none()).unwrap_or(false)
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

    /// Spawn a new terminal process using std::process with Stdio::piped().
    /// Both stdout and stderr are captured via raw `read()` calls, preserving
    /// ANSI escape sequences and avoiding line-buffering truncation.
    ///
    /// Uses `cmd /c` to run the startup command through the Windows shell,
    /// which handles path resolution and environment variable expansion.
    pub fn spawn(
        &self,
        app: tauri::AppHandle,
        config_id: String,
        version_id: i64,
        working_dir: String,
        startup_command: Option<String>,
    ) -> Result<String, String> {
        let session_id = uuid::Uuid::new_v4().to_string();

        let clean_command = startup_command.as_ref().map(|sc| strip_path_quotes(sc));

        // Build cmd /c command — cmd.exe handles argument parsing and path resolution.
        // We do NOT escape metacharacters here because cmd /c needs them to function.
        let cmd_arg = if let Some(sc) = &clean_command {
            sc.clone()
        } else {
            String::new()
        };

        let cmd_display = if cmd_arg.is_empty() {
            "cmd".to_string()
        } else {
            format!("cmd /c {}", &cmd_arg[..cmd_arg.len().min(80)])
        };

        log::info!("[TERMINAL] Spawning process: version_id={} | config_id={} | cmd={} | dir={} | sessions_before={}",
            version_id, config_id, cmd_display, working_dir, self.session_count());

        // Spawn via std::process with piped stdout+stderr
        let mut cmd = std::process::Command::new("cmd");
        cmd.arg("/c");
        if !cmd_arg.is_empty() {
            cmd.arg(&cmd_arg);
        }
        cmd.current_dir(&working_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        // On Windows: do NOT create a new console window for the child process.
        // This ensures all output goes through our pipes, not a separate console.
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn process: {}", e))?;

        let pid = child.id();
        log::info!("[TERMINAL] Process spawned: session={} | pid={} | version_id={} | config_id={}",
            session_id, pid, version_id, config_id);

        let output_buffer = OutputBuffer::new();
        let buffer_arc = output_buffer.clone_arc();

        // Take ownership of stdout and stderr pipes before storing the child.
        // After take(), the Child's stdout/stderr become None (preventing double-close).
        let stdout = child.stdout.take().ok_or_else(|| "No stdout pipe".to_string())?;
        let stderr = child.stderr.take().ok_or_else(|| "No stderr pipe".to_string())?;

        let session = TerminalSession {
            process: Arc::new(Mutex::new(UnsafeChild(child))),
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

        // Spawn reader threads for stdout and stderr in parallel
        spawn_stdio_reader(stdout, "stdout".to_string(), session_id.clone(), app.clone(), buffer_arc.clone());
        spawn_stdio_reader(stderr, "stderr".to_string(), session_id.clone(), app.clone(), buffer_arc);

        // Emit 'server-ready' so the frontend can transition from 'starting' → 'running'.
        // The process is confirmed alive at this point (spawn succeeded, pipes captured).
        let _ = app.emit("server-ready", session_id.clone());

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
                    log::info!("[TERMINAL] process exited for {}", sid);
                    let _ = app_handle.emit("terminal-exit", TerminalExitEvent {
                        session_id: sid.clone(),
                        reason: TerminalExitReason::Exited,
                    });
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
        let (config_id, pid, process) = {
            let mut sessions = self
                .sessions
                .lock()
                .map_err(|e| format!("Mutex poisoned: {}", e))?;

            let session = sessions
                .remove(session_id)
                .ok_or_else(|| format!("Session not found: {}", session_id))?;

            (session.config_id.clone(), session.pid, session.process)
        };

        // Check if the process is still alive before attempting taskkill.
        // If the process already exited (e.g. server crashed, user closed terminal),
        // skip taskkill to avoid "process not found" warnings.
        let is_alive = {
            let mut proc = process.lock().unwrap();
            proc.0.try_wait().map(|r| r.is_none()).unwrap_or(false)
        };

        if is_alive {
            log::info!("[TERMINAL] Killing process tree: session={} | pid={}", session_id, pid);

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
                    log::warn!("[TERMINAL] Failed to execute taskkill for PID {}: {} (process may have already exited)", pid, e);
                }
            }
        } else {
            log::info!("[TERMINAL] Process already exited: session={} | pid={} — skipping taskkill", session_id, pid);
        }

        // Session removed from HashMap, process killed or already dead.
        // Emit terminal-exit with "killed" reason so the frontend knows this
        // was an intentional stop and skips the error badge.
        let _ = app.emit("terminal-exit", TerminalExitEvent {
            session_id: session_id.to_string(),
            reason: TerminalExitReason::Killed,
        });

        Ok(config_id)
    }

    /// Kill all terminal sessions and their child processes (cleanup on app exit).
    /// Spawns taskkill for each session in parallel using std::thread, then joins
    /// all handles. This reduces total kill time from O(n * taskkill) to O(max(taskkill)).
    /// Uses std::thread (not tokio) to avoid panics when the Tokio runtime is dropped.
    /// Returns the number of sessions that were killed.
    pub fn kill_all(&self) -> usize {
        let sessions: Vec<_> = match self.sessions.lock() {
            Ok(mut s) => s.drain().map(|(_id, s)| s).collect(),
            Err(_) => return 0,
        };

        let count = sessions.len();
        log::info!("[TERMINAL] kill_all: killing {} session(s) in parallel", count);

        // Spawn taskkill for each session in parallel
        let handles: Vec<_> = sessions
            .into_iter()
            .map(|session| {
                let pid = session.pid;
                std::thread::spawn(move || {
                    log::info!("[TERMINAL] kill_all: killing process tree pid={}", pid);

                    if let Err(e) = std::process::Command::new("taskkill")
                        .args(["/T", "/F", "/PID", &pid.to_string()])
                        .output()
                    {
                        log::warn!("[TERMINAL] kill_all: failed to execute taskkill for PID {}: {}", pid, e);
                    }
                })
            })
            .collect();

        // Wait for all taskkill threads to complete
        for handle in handles {
            let _ = handle.join();
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
