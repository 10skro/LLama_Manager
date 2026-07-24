# AGENTS.md

## Quick Start

```bash
npm install              # frontend deps
npm run tauri dev        # dev mode (Vite + Tauri hot-reload)
npm run tauri build      # production build
```

Binaries land in `src-tauri/target/release/bundle/`.

## Tech Stack

| Layer    | Tech                                              |
|----------|---------------------------------------------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| State    | Zustand (local), TanStack React Query (server)    |
| Backend  | Rust, Tauri v2                                    |
| Database | SQLite (rusqlite, bundled)                        |

## Commands

| Command                  | What it does                                    |
|--------------------------|-------------------------------------------------|
| `npm run dev`            | Vite dev server only (port 1420, strictPort)    |
| `npm run build`          | `tsc && vite build` — typecheck THEN bundle     |
| `npm run preview`        | Serve production build                          |
| `npm run tauri dev`      | Full dev: Vite + Tauri watcher + hot-reload     |
| `npm run tauri build`    | Full production: builds frontend then Rust      |

**Important:** `npm run build` runs `tsc` before `vite build`. TypeScript errors will block the build. Do not skip typecheck.

## Version Sync

These four files must share the same version:
- `package.json` → `"version"`
- `src-tauri/Cargo.toml` → `version`
- `src-tauri/tauri.conf.json` → `"version"`
- `release.json` → `"tag_name"` and `"name"`

Current version: **0.5.34**

## Project Structure

```
src/                    # Frontend (React/TS)
├── components/         # Reusable UI components + shadcn/ui in components/ui/
├── pages/              # Route-level page components
├── services/           # Tauri API wrapper functions (invoke bridge)
├── store/              # Zustand stores
├── hooks/              # Custom React hooks
├── themes/             # Color theme definitions (CSS variables)
├── types/              # TypeScript type definitions
├── lib/utils.ts        # shadcn utility (cn helper)
├── index.css           # Tailwind + CSS variable theme root
├── App.tsx             # Router + layout root
└── main.tsx            # React entrypoint

src-tauri/              # Backend (Rust/Tauri)
├── src/
│   ├── main.rs         # Tauri binary entrypoint
│   ├── lib.rs          # Command registration + Tauri builder
│   ├── config/         # App settings & preferences
│   ├── db/             # SQLite database layer
│   ├── download/       # Download manager
│   ├── file/           # File operations
│   ├── github/         # GitHub API client (reqwest)
│   ├── models/         # Shared data types & structs
│   ├── terminal/       # Terminal spawning (xterm.js backend)
│   ├── utils/          # Shared utilities
│   └── version/        # Version tracking & management
├── Cargo.toml
├── tauri.conf.json     # Tauri config (CSP, window, bundle)
└── build.rs            # Tauri build script (auto-generated)
```

## Key Conventions

- **Path alias:** `@/*` resolves to `./src/*` (Vite + tsconfig)
- **shadcn/ui:** "new-york" style, CSS variables, non-RSC. UI components live in `src/components/ui/`. Add components via `npx shadcn@latest add ...`
- **Theming:** CSS variables in `src/index.css`. Tailwind colors map to HSL variables. Switch themes by toggling `class` on `<html>` and swapping variable values.
- **State:** Zustand for local UI state. TanStack React Query for server/fetch state. No Redux.
- **Tauri commands:** Registered in `src-tauri/src/lib.rs`. Frontend calls via `@tauri-apps/api` `invoke()`.
- **Database:** SQLite file created at runtime. Schema managed in `src-tauri/src/db/`. rusqlite uses bundled SQLite (no system dependency).
- **CSP:** `connect-src` allows only `api.github.com` and IPC. No arbitrary outbound HTTP from frontend.

## Dev Server

- Vite runs on **port 1420** with `strictPort: true` (will fail if port is taken, won't fallback)
- `clearScreen: false` in vite.config.ts (needed for Tauri dev output readability)
- Watch ignores `**/src-tauri/target/**` to avoid Rust build noise

## Build Artifacts (gitignored)

- `dist/` — Vite production output
- `src-tauri/target/` — Rust build artifacts
- `src-tauri/gen/` — Tauri generated schema files
- `*.db` — SQLite database files

## No CI/CD

No GitHub Actions or CI workflows are configured. Building and testing is local only.

## Release Process

`release.json` and `release_body.md` in the repo root are prepared for manual GitHub release creation. Version must be synced across all four version files before releasing.
