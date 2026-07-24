## Changes

### Features
- Add Launch Configuration Builder for creating custom llama.cpp launch commands
- Add CMD and PowerShell command generation with proper line-continuation syntax
- Add searchable argument catalog with 34 common llama.cpp flags across 8 categories
- Add live command preview with copy-to-clipboard functionality
- Add model folder setting to browse and select .gguf model files
- Add argument builder with add, remove, and reorder capabilities
- Add SQLite persistence for launch configurations

### Fixes
- Fix duplicate model flag risk in command generation
- Fix hardcoded executable path in command preview
- Fix database error handling in Rust backend
- Fix boolean argument handling in command output
- Fix model dropdown overflow in dialog
- Fix clipboard API usage (modern navigator.clipboard)
- Fix number input types for argument values
- Add database index for launch configuration queries
- Remove unused configuration type definition
