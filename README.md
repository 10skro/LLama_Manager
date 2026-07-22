# LlamaCpp Manager

A desktop GUI manager for [llama.cpp](https://github.com/ggerganov/llama.cpp) builds. Browse, download, and manage different llama.cpp releases with various AI backends (CPU, CUDA, Vulkan, and more) — all from a clean, modern interface.

[![Version](https://img.shields.io/badge/version-0.2.6-blue.svg)](https://github.com/10skro/LLamaCpp_Manager/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/built%20with-Tauri%20v2-FFC131?logo=tauri)](https://tauri.app)
[![Rust](https://img.shields.io/badge/Rust-latest%20stable-orange.svg?logo=rust)](https://www.rust-lang.org)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation & Development](#installation--development)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Themes](#themes)
- [License](#license)

---

## Features

- **Browse Releases** — Search and filter llama.cpp releases directly from the GitHub API.
- **Multi-Backend Support** — Download builds for CPU, CUDA, Vulkan, and other backends.
- **Version Tracking** — Keep track of every installed version at a glance.
- **Favorites** — Mark and quickly access your most-used builds.
- **Changelog Viewer** — Read release notes rendered as formatted Markdown.
- **Configurable Storage** — Set custom download paths and GitHub API tokens.
- **Theming** — Dark and light mode with custom themes (Catppuccin Mocha, Rosé Pine Dawn, Rosé Pine Moon).

---

## Tech Stack

| Layer    | Technology                                          |
|----------|-----------------------------------------------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| State    | Zustand, TanStack React Query                       |
| Backend  | Rust, Tauri v2                                      |
| Database | SQLite (rusqlite)                                   |
| HTTP     | reqwest (GitHub API integration)                    |
| Async    | tokio                                               |

---

## Installation & Development

### Prerequisites

- **Node.js** 18 or later
- **Rust** (latest stable) — [install via rustup](https://rustup.rs/)
- **Tauri CLI**

### Setup

```bash
# Clone the repository
git clone https://github.com/10skro/LLamaCpp_Manager.git
cd LLamaCpp_Manager

# Install frontend dependencies
npm install

# Install Tauri CLI (if not already installed)
cargo install tauri-cli

# Start development mode
npm run tauri dev
```

### Build for Production

```bash
npm run tauri build
```

The compiled binaries will be available in `src-tauri/target/release/bundle/`.

---

## Project Structure

```
LLamaCpp_Manager/
├── src/                    # Frontend (React / TypeScript)
│   ├── components/         # Reusable UI components
│   ├── pages/              # Route-level page components
│   ├── services/           # Tauri API wrapper functions
│   ├── store/              # Zustand state management
│   ├── hooks/              # Custom React hooks
│   └── themes/             # Color theme definitions
├── src-tauri/              # Backend (Rust / Tauri)
│   ├── src/                # Rust source code
│   │   ├── config/         # Application settings & preferences
│   │   ├── db/             # SQLite database layer
│   │   ├── download/       # Download manager
│   │   ├── github/         # GitHub API client
│   │   ├── models/         # Shared data types & structs
│   │   └── version/        # Version tracking & management
│   ├── Cargo.toml
│   └── tauri.conf.json
└── package.json
```

---

## Configuration

The application stores user settings (storage paths, API tokens, theme preferences, etc.) in a local SQLite database managed by the Rust backend. All configuration is accessible through the Settings page in the application UI.

### GitHub API Token (Optional)

Providing a GitHub personal access token in the settings increases the unauthenticated API rate limit, allowing more frequent release lookups.

---

## Themes

LlamaCpp Manager ships with several built-in themes:

| Theme            | Mode  |
|------------------|-------|
| Default Dark     | Dark  |
| Default Light    | Light |
| Catppuccin Mocha | Dark  |
| Rosé Pine Dawn   | Light |
| Rosé Pine Moon   | Dark  |

Switch themes from the Settings page. Custom themes can be added by extending the theme definitions in `src/themes/`.

---

## License

See [LICENSE](LICENSE) for more information.
