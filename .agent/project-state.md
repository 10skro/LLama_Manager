# Project State

## Current Status
- **Version**: 0.5.36
- **Last Update**: 2026-07-25

## Recent Changes
- **Completed**: Full removal of LaunchConfig ("Build Config") system from frontend and backend
  - Deleted: `src/components/LaunchConfig/`, `src/services/launchConfig.ts`, `src/utils/buildLaunchCommand.ts`, `src/data/llamaCppArgs.ts`
  - Deleted: `src-tauri/src/launch_config.rs`
  - Created: `src/services/modelFiles.ts` (extracted `scanModelFiles` from deleted launchConfig.ts)
  - Updated all frontend files to remove LaunchConfig references
  - Updated all backend files to remove LaunchConfig references
  - Preserved: CustomCommand system, VersionConfigLink system (now only for 'custom' type), ModelFile type

## Active Features
- Dashboard with version cards
- Custom commands (preserved)
- Version config links (now only 'custom' type)
- Model file scanning (via new modelFiles.ts service)
- Card customization
- Version overrides

## Known Limitations
- VersionConfigLink now only supports 'custom' config type (launch removed)
