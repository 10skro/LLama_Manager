## Changes

### Fixes
- Replace ConPTY with pipe-based stdout/stderr capture for real-time terminal output
- Fix terminal-output event serialization (struct instead of tuple)
- Fix terminal window errors (camelCase serialization, Tauri capabilities)
- Add output buffer for late-joining terminal viewers
- Fix process spawning with commandline() instead of ProcAttr::cmd()

### Refactoring
- Migrate terminal I/O from ConPTY to pipe-based capture
