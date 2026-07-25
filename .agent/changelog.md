# Changelog

## 2026-07-25
- **Removed**: LaunchConfig ("Build Config") system entirely
  - Deleted frontend: `LaunchConfig/` components, `launchConfig.ts`, `buildLaunchCommand.ts`, `llamaCppArgs.ts`
  - Deleted backend: `launch_config.rs` module, `launch_configs` table, `LaunchConfig` model
  - Created: `src/services/modelFiles.ts` with extracted `scanModelFiles` function
  - Updated: All references to LaunchConfig removed across frontend and backend
  - Preserved: CustomCommand system, VersionConfigLink (now only 'custom' type), ModelFile type
