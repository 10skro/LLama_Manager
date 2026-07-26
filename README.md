# Llama Manager

A modern Windows desktop application for managing [llama.cpp](https://github.com/ggerganov/llama.cpp) builds. Browse, download, configure, and run llama.cpp servers — all from a clean, intuitive interface.

[![Version](https://img.shields.io/badge/version-0.6.10-blue.svg)](https://github.com/10skro/LLamaCpp_Manager/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg?logo=windows)](https://www.microsoft.com/windows)

---

## Table of Contents

- [What It Does](#what-it-does)
- [Features](#features)
  - [Dashboard](#dashboard)
  - [Catalog](#catalog)
  - [Configs](#configs)
  - [Terminals](#terminals)
  - [Settings](#settings)
- [Getting Started](#getting-started)
- [How It Works](#how-it-works)
- [Themes](#themes)
- [System Requirements](#system-requirements)
- [License](#license)

---

## What It Does

Llama Manager simplifies working with llama.cpp on Windows. Instead of manually downloading builds from GitHub, extracting archives, and running commands in a terminal, you get a single application that handles everything:

- **Find** the right build for your hardware (CPU, CUDA, Vulkan, etc.)
- **Download and install** it with one click
- **Configure** how each build runs (model, arguments, etc.)
- **Launch and stop** servers directly from the dashboard
- **Manage** multiple builds side by side

---

## Features

### Dashboard

Your main workspace. Every installed llama.cpp build appears as a card with its details at a glance.

- **Overview stats** — See how many versions are installed, the latest build number, and total storage used.
- **Version cards** — Each card shows the build number, backend (CPU / CUDA / Vulkan), and architecture (x64 / arm64).
- **Play / Stop** — Launch or stop a llama.cpp server directly from a card. A green "Running" indicator shows active servers.
- **Link a config** — Attach a saved startup command to any version card so you can launch it with one click.
- **Clone a version** — Create a copy of a card that shares the same installed files, so you can run the same build with different configurations.
  - **Clone** — Clean copy with default settings.
  - **Clone with Settings** — Duplicate including custom title, colors, config link, and overrides.
- **Safe delete** — Removing a card only deletes the installed files if no other card is using them.
- **Customize cards** — Give each card a custom title, header color, and text color to organize your workspace visually.
- **Model overrides** — Override the model (`.gguf`, `.safetensors`) and multimodal projector (`.mmproj`) paths per card, choosing from files in your configured folders.

### Catalog

Browse and download all available llama.cpp builds directly from the official GitHub repository.

- **Browse builds** — See every available release grouped by version, with backend and architecture details.
- **Filter by backend** — Show only CPU, CUDA, Vulkan, or any other backend.
- **Filter by architecture** — x64 or arm64.
- **Search by tag** — Jump directly to a specific version tag (e.g., `b3500`).
- **Favorites** — Mark builds as favorites for quick access. Filter to show only favorited builds.
- **Installed indicator** — See at a glance which builds are already installed.
- **Download with progress** — Start a download and track its progress in real time. Downloads can be cancelled at any time.
- **Changelog viewer** — Read the release notes for any version, rendered as formatted markdown.
- **Refresh catalog** — Manually check for new builds. The app also checks automatically on startup.

### Configs

Create and manage custom startup commands for launching llama.cpp servers.

- **Create a custom command** — Define a name, description, and the command-line arguments to pass when launching `llama-server`.
- **Color-coded** — Assign a color to each config for easy identification.
- **Edit and delete** — Modify or remove any saved config.
- **Search** — Find configs by name or description.
- **Link to a version** — Attach a config to any version card on the Dashboard to enable one-click launch.

> **Tip:** You don't need to type `llama-server.exe` in your command — the app handles the executable path automatically when launching from a card.

### Terminals

A dedicated floating window for managing running llama.cpp servers.

- **Multiple sessions** — Run several servers at the same time, each in its own terminal.
- **List view** — Sidebar with all sessions, showing one terminal at a time.
- **Grid view** — See all active terminals side by side.
- **Close sessions** — Stop individual servers from the terminal window.

### Settings

Customize the application to your preferences.

- **Appearance**
  - Choose from built-in themes (dark and light).
  - Pick your preferred font.
- **Models**
  - Set a folder for your `.gguf` and `.safetensors` model files. Models in this folder will be available when configuring overrides on version cards.
  - Set a folder for your `.mmproj` multimodal projector files.
- **Notifications**
  - Adjust how long notification pop-ups stay visible.
- **Advanced**
  - Add a GitHub Personal Access Token to increase the API rate limit (useful if you browse the catalog frequently).

---

## Getting Started

### Installation

1. Download the latest installer from the [Releases](https://github.com/10skro/LLamaCpp_Manager/releases) page.
2. Run the `.exe` installer and follow the prompts.
3. Launch **Llama Manager** from your Start menu or desktop.

### First Steps

1. **Browse builds** — Go to the **Catalog** and find a build that matches your hardware (e.g., CUDA if you have an NVIDIA GPU, or CPU otherwise).
2. **Download** — Click the download button on any build row. Progress appears in the bottom-right panel.
3. **Create a config** — Go to **Configs** and create a startup command with your model path and arguments.
4. **Link and launch** — Back on the **Dashboard**, open a version card, link your config, and click **Play**.

---

## How It Works

```
Catalog                    Dashboard              Terminals
┌──────────────┐          ┌──────────────┐       ┌──────────────┐
│ Browse builds │  ──────▶│ Version cards │ ────▶│ Server output│
│ Filter /     │  download│ Play / Stop  │ launch│ Multi-session│
│ Search       │          │ Clone /      │       │ List / Grid  │
│ Favorites    │          │ Customize    │       └──────────────┘
└──────────────┘          └──────────────┘
                            │
                            │ link
                            ▼
                       ┌──────────────┐
                       │  Configs     │
                       │ Custom       │
                       │ Commands     │
                       └──────────────┘
```

1. **Catalog** → Find and download a llama.cpp build.
2. **Configs** → Create a startup command with your preferred arguments.
3. **Dashboard** → Link the config to a version card and launch the server.
4. **Terminals** → Monitor and manage running servers in a floating window.

---

## Themes

Llama Manager ships with three built-in themes:

| Theme            | Mode  |
|------------------|-------|
| Catppuccin Mocha | Dark  |
| Rosé Pine Dawn   | Light |
| Rosé Pine Moon   | Dark  |

Switch themes from **Settings → Appearance**.

---

## System Requirements

- **OS:** Windows 10 or later
- **Architecture:** x64 or arm64
- **RAM:** 4 GB minimum (more recommended for running large models)
- **Internet:** Required for downloading builds from GitHub

---

## License

See [LICENSE](LICENSE) for more information.
