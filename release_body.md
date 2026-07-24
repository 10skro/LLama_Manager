## Changes

### Features
- Add per-version model and mmproj path overrides with visual badge
- Add mmproj folder setting for browsing .mmproj project files
- Add shell type selection (CMD/PowerShell) for custom commands with auto-detection
- Add folder validation for path settings

### Fixes
- Use correct shell type when launching custom commands via terminal
- Improve newline handling in terminal command injection

### Refactoring
- Extract shared file scanning utility for generic extension-based scanning
- Extract launch command builder to dedicated utility module
