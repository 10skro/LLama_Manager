use std::collections::HashMap;
use std::io::{Read, Write};
use std::process::{Child, Stdio};
use std::sync::Mutex;

use tauri::Emitter;

/// Represents an active terminal session with access to all I/O streams.
pub struct TerminalSession {
    pub child: Child,
    pub stdin: Option<std::process::ChildStdin>,
    pub config_id: String,
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

    /// Spawn a new terminal process (cmd.exe or powershell.exe).
    /// Returns a session ID that can be used to interact with the terminal.
    pub fn spawn(
        &self,
        app: tauri::AppHandle,
        config_id: String,
        shell_type: String,
        working_dir: String,
    ) -> Result<String, String> {
        let session_id = uuid::Uuid::new_v4().to_string();

        // Determine shell executable and arguments
        let (program, args) = if shell_type.to_lowercase() == "powershell" {
            ("powershell.exe", vec!["-NoExit"])
        } else {
            ("cmd.exe", vec!["/K"])
        };

        let mut cmd = std::process::Command::new(program);
        let mut child = cmd
            .args(&args)
            .current_dir(&working_dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn {}: {}", program, e))?;

        let stdin = child.stdin.take();
        let stdout = child.stdout.take().ok_or("Failed to get stdout")?;
        let stderr = child.stderr.take().ok_or("Failed to get stderr")?;

        // Store session with stdin handle
        let session = TerminalSession {
            child,
            stdin,
            config_id: config_id.clone(),
        };

        self.sessions
            .lock()
            .map_err(|e| format!("Mutex poisoned: {}", e))?
            .insert(session_id.clone(), session);

        // Spawn stdout reader task - reads raw bytes to preserve ANSI escape sequences
        let app_stdout = app.clone();
        let sid_stdout = session_id.clone();
        std::thread::spawn(move || {
            let mut buffer = [0u8; 4096];
            let mut stdout_reader = std::io::BufReader::new(stdout);
            loop {
                match stdout_reader.read(&mut buffer) {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        let text = String::from_utf8_lossy(&buffer[..n]).to_string();
                        let _ = app_stdout.emit("terminal-output", (sid_stdout.clone(), text));
                    }
                    Err(_) => break,
                }
            }
            // Emit exit signal when stdout closes
            let _ = app_stdout.emit("terminal-exit", sid_stdout.clone());
        });

        // Spawn stderr reader task - reads raw bytes to preserve ANSI escape sequences
        let app_stderr = app.clone();
        let sid_stderr = session_id.clone();
        std::thread::spawn(move || {
            let mut buffer = [0u8; 4096];
            let mut stderr_reader = std::io::BufReader::new(stderr);
            loop {
                match stderr_reader.read(&mut buffer) {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        let text = String::from_utf8_lossy(&buffer[..n]).to_string();
                        let _ = app_stderr.emit("terminal-output", (sid_stderr.clone(), text));
                    }
                    Err(_) => break,
                }
            }
        });

        Ok(session_id)
    }

    /// Write input to a terminal session's stdin.
    pub fn write_input(&self, session_id: &str, input: String) -> Result<(), String> {
        let mut sessions = self
            .sessions
            .lock()
            .map_err(|e| format!("Mutex poisoned: {}", e))?;

        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;

        if let Some(ref mut stdin) = session.stdin {
            // Write raw bytes (no extra newline - the frontend sends \r\n for Enter)
            stdin
                .write_all(input.as_bytes())
                .map_err(|e| format!("Failed to write to stdin: {}", e))?;
            stdin.flush().map_err(|e| format!("Failed to flush stdin: {}", e))?;
        } else {
            return Err("stdin not available for this session".to_string());
        }

        Ok(())
    }

    /// Kill a terminal session and wait for it to exit (prevents zombie processes).
    pub fn kill(&self, session_id: &str) -> Result<String, String> {
        // Extract session from map to avoid holding lock during wait
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

        // Drop stdin first to close the pipe
        let mut child = session.child;

        child
            .kill()
            .map_err(|e| format!("Failed to kill terminal: {}", e))?;

        // Wait for process to exit to prevent zombie processes
        let _ = child.wait();

        Ok(config_id)
    }

    /// Kill all terminal sessions (cleanup on app exit).
    pub fn kill_all(&self) {
        // Extract all sessions to avoid holding lock during kill/wait
        let sessions: Vec<_> = match self.sessions.lock() {
            Ok(mut s) => s.drain().map(|(_id, s)| s).collect(),
            Err(_) => return,
        };

        for session in sessions {
            let mut child = session.child;
            if let Err(e) = child.kill() {
                log::warn!("Failed to kill terminal session: {}", e);
            }
            // Wait for process to exit to prevent zombie processes
            let _ = child.wait();
        }
    }

    /// Get the count of active sessions.
    pub fn session_count(&self) -> usize {
        match self.sessions.lock() {
            Ok(sessions) => sessions.len(),
            Err(_) => 0,
        }
    }
}

impl Default for TerminalManager {
    fn default() -> Self {
        Self::new()
    }
}
