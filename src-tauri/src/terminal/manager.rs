use std::collections::{HashMap, VecDeque};
use std::io::Read;
use std::sync::{Arc, Mutex};

use tauri::{Emitter, Manager};

/// Wrapper around conpty::Process to make it Send + Sync.
/// Safe because conpty::Process only holds Windows HANDLEs which are thread-safe.
pub struct ConptyProcess(conpty::Process);

unsafe impl Send for ConptyProcess {}
unsafe impl Sync for ConptyProcess {}

impl ConptyProcess {
    pub fn new(process: conpty::Process) -> Self {
        Self(process)
    }
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

/// Represents an active terminal session using ConPTY.
pub struct TerminalSession {
    pub process: ConptyProcess,
    pub config_id: String,
    pub version_id: i64,
    pub output_buffer: OutputBuffer,
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

    /// Spawn a new terminal process using ConPTY (Windows Pseudo-Console).
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

        // Build the command to run
        // Escape cmd.exe metacharacters to prevent command injection / truncation
        let escaped = if let Some(sc) = &startup_command {
            sc.replace('^', "^^")
               .replace('&', "^&")
               .replace('|', "^|")
               .replace('>', "^>")
               .replace('<', "^<")
               .replace('%', "^%")
               .replace('!', "^!")
        } else {
            String::new()
        };
        let cmd_str = if escaped.is_empty() {
            "cmd /K".to_string()
        } else {
            format!("cmd /K {}", escaped)
        };

        log::info!("[TERMINAL] Spawning ConPTY: version_id={} | config_id={} | cmd={} | dir={} | sessions_before={}",
            version_id, config_id, cmd_str, working_dir, self.session_count());

        // Spawn process using ConPTY
        let process = conpty::ProcAttr::cmd(cmd_str)
            .current_dir(&working_dir)
            .spawn()
            .map_err(|e| format!("Failed to spawn ConPTY process: {}", e))?;

        let pid = process.pid();
        log::info!("[TERMINAL] Process spawned: session={} | pid={} | version_id={} | config_id={}", session_id, pid, version_id, config_id);

        // Store session with output buffer (4 KB circular buffer)
        let output_buffer = OutputBuffer::new(4096);
        let buffer_arc = output_buffer.clone_arc();
        let session = TerminalSession {
            process: ConptyProcess(process),
            config_id: config_id.clone(),
            version_id,
            output_buffer,
        };

        self.sessions
            .lock()
            .map_err(|e| format!("Mutex poisoned: {}", e))?
            .insert(session_id.clone(), session);

        log::info!("[TERMINAL] sessions_after={}", self.session_count());

        // Spawn output reader task
        let app_handle = app.clone();
        let sid = session_id.clone();

        std::thread::spawn(move || {
            log::info!("[TERMINAL] ConPTY reader started for {}", sid);

            // Get a reader from the session
            let sessions = app_handle.state::<TerminalManager>();
            let reader = {
                let sess = sessions.sessions.lock().unwrap();
                if let Some(session) = sess.get(&sid) {
                    session.process.0.output().ok()
                } else {
                    None
                }
            };

            if let Some(mut reader) = reader {
                let mut buf = [0u8; 4096];
                loop {
                    match reader.read(&mut buf) {
                        Ok(0) => {
                            log::info!("[TERMINAL] ConPTY EOF for {}", sid);
                            break;
                        }
                        Ok(n) => {
                            let text = String::from_utf8_lossy(&buf[..n]).to_string();
                            log::info!(
                                "[TERMINAL] ConPTY received {} bytes: {:?}",
                                n,
                                text.chars().take(80).collect::<String>()
                            );
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
                            let _ = app_handle.emit("terminal-output", TerminalOutputEvent {
                                session_id: sid.clone(),
                                text: text.clone(),
                            });
                        }
                        Err(e) => {
                            log::warn!("[TERMINAL] ConPTY read error: {}", e);
                            break;
                        }
                    }
                }
            }

            let _ = app_handle.emit("terminal-exit", sid.clone());
        });

        Ok(session_id)
    }

    /// Write input to a terminal session's ConPTY.
    pub fn write_input(&self, session_id: &str, input: String) -> Result<(), String> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|e| format!("Mutex poisoned: {}", e))?;

        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;

        // Get a writer and write to it
        let mut writer = session.process.0
            .input()
            .map_err(|e| format!("Failed to get input writer: {}", e))?;

        use std::io::Write;
        writer
            .write_all(input.as_bytes())
            .map_err(|e| format!("Failed to write to ConPTY: {}", e))?;

        Ok(())
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
        session.process.0.exit(1)
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
            if let Err(e) = session.process.0.exit(1) {
                log::warn!("Failed to kill terminal session: {}", e);
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
