## Changes

### Features
- Multi-extension file scan (.gguf + .safetensors) in Rust backend and TypeScript
- File type filter toggle in OverrideDialog (All / .gguf / .safetensors)
- Extension badge on file items in dropdown selectors

### Fixes
- OverrideDialog freeze on close (state cleanup + mounted guard)
- mmproj_folder missing from App.tsx startup settings merge
- Override not injected into useTerminalLaunch command builder
- scanModelFiles parameter name mismatch (folder vs folderPath)

### Style
- SelectContent backdrop-blur to match DropdownMenuContent glassmorphism

### Chores
- Remove debug console.log from OverrideDialog
- Remove .agent/ directory files
