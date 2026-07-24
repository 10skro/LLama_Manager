## Changes

### Features
- Integrated terminal (cmd/PowerShell) via xterm.js
- Play button replaces Open on version cards
- Backend terminal module with spawn, write, and kill commands
- Dockable terminal panel at the bottom of the app
- Automatic shell type detection from database
- Auto-execution of configuration commands in terminal

### Fixes
- ANSI escape sequences preserved in terminal output
- Zombie process cleanup on terminal kill and app exit
- Removed unsafe Rust implementations
