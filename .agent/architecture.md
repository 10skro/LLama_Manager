# Architecture

## Tech Stack
- **Frontend**: React + TypeScript + Vite + Zustand + Radix UI
- **Backend**: Rust + Tauri + SQLite (rusqlite)
- **Package Manager**: npm

## Project Structure
```
src/
├── components/         # React components
│   ├── Dashboard/      # Dashboard-related components
│   ├── CustomCommand/  # Custom command modal
│   └── Terminal/       # Terminal components
├── hooks/              # React hooks
├── pages/              # Page components
├── services/           # Backend API services
├── store/              # Zustand stores
├── types/              # TypeScript type definitions
└── utils/              # Utility functions

src-tauri/
├── src/
│   ├── db/             # Database layer (connection, repo)
│   ├── models/         # Rust data models
│   └── lib.rs          # Tauri commands entry point
```

## Key Components
- **useAppStore**: Central Zustand store for app state
- **useTerminalLaunch**: Hook for launching commands in terminal
- **useVersionConfigLinks**: Hook for managing version-to-config links
- **VersionConfigLink**: Links installed versions to custom commands
- **CustomCommand**: User-defined command templates

## Data Flow
1. Frontend calls Tauri commands via `invoke` from `@tauri-apps/api/core`
2. Tauri commands in `lib.rs` delegate to service modules
3. Service modules use `repo.rs` for database operations
4. Database uses SQLite with rusqlite

## Important Patterns
- All backend invocations use `@tauri-apps/api/core` invoke
- Database operations go through `DbManager` singleton
- Types defined in `src/types/index.ts` mirror Rust models
