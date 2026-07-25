# Decisions

## Decision: Remove LaunchConfig System (2026-07-25)

### Context
The "Build Config" (LaunchConfig) assistant feature was removed from the application.

### Chosen Solution
Complete removal of all LaunchConfig-related code from both frontend and backend:
- Deleted all LaunchConfig components, services, and data files
- Deleted backend launch_config.rs module
- Removed launch_configs table from database schema
- Removed LaunchConfig type from Rust models
- Updated VersionConfigLink to only support 'custom' config type
- Extracted `scanModelFiles` to new `src/services/modelFiles.ts` service

### Reason
Simplify the application by removing unused/unnecessary LaunchConfig functionality while preserving CustomCommand system.

### Alternatives Considered
- Keeping the backend code but removing frontend UI (rejected - dead code)
- Converting LaunchConfig to CustomCommand (rejected - different use cases)
