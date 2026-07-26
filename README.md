# Llama Manager

A modern Windows desktop application for managing [llama.cpp](https://github.com/ggerganov/llama.cpp) builds. Browse, download, configure, and run llama.cpp servers — all from a clean, intuitive interface.

[![Version](https://img.shields.io/badge/version-0.6.13-blue.svg)](https://github.com/10skro/LLama_Manager/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg?logo=windows)](https://www.microsoft.com/windows)

---

## Table of Contents

- [Installation](#installation)
- [Features](#features)
  - [Dashboard](#dashboard)
  - [Catalog](#catalog)
  - [Configurations](#configurations)
  - [Terminals](#terminals)
- [Getting Started](#getting-started)
- [Themes](#themes)
- [System Requirements](#system-requirements)
- [License](#license)

---

## Installation

> **Windows only.** Llama Manager is a native Windows desktop application.

### Installer

1. Download the latest `.exe` installer from the [Releases](https://github.com/10skro/LLama_Manager/releases) page.
2. Run the installer and follow the prompts.
3. Launch **Llama Manager** from your Start menu or desktop.

### From Source

**Prerequisites:**

- [Node.js 18+](https://nodejs.org/)
- [Rust 1.77+](https://www.rust-lang.org/tools/install)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (Windows)
- [Git](https://git-scm.com/)

```cmd
git clone https://github.com/10skro/LLama_Manager.git
cd LLama_Manager
npm install
npm run tauri dev
```

**Build release**

```cmd
npm run tauri build
```

---

## Features

Llama Manager simplifies using llama.cpp on Windows. Instead of manually downloading versions from GitHub, extracting archives, and typing commands into a terminal, you have a single application that handles the entire process:

- **Finding** the version suited to your hardware (CPU, CUDA, Vulkan)
- **Downloading and installing** that version with a single click
- **Configuring** runtime settings for each version (model, arguments, etc.)
- **Starting and stopping** servers directly from the dashboard
- **Managing** multiple versions simultaneously

---

### Dashboard

Your main workspace. Each installed llama.cpp build appears as a card displaying its details at a glance.

- **Start / Stop** — Start or stop a llama.cpp server directly from the card. A green "Running" indicator marks active servers.
- **Link a configuration** — Associate a saved startup command with any build card to launch it with a single click.
- **Clone a build** — Create a copy of the card that shares the same installed files, allowing you to run the same build with different configurations.
- **Customize cards** — Assign a custom title, header color, and text color to each card to visually organize your workspace.
- **Model substitution** — Override the paths for the model (`.gguf`, `.safetensors`) and multimodal projector (`.mmproj`) for each card by selecting from files in your configured folders.

### Catalog

Browse and download all llama.cpp builds available directly from the official GitHub repository.

- **Browse builds** — View all available builds, grouped by version number, including backend and architecture details.
- **Filter by backend** — Show only builds for CPU, CUDA, Vulkan, or other backends.
- **Filter by architecture** — x64 or arm64.
- **Search by tag** — Jump directly to a specific version tag (e.g., `b3500`).
- **Favorites** — Mark builds as favorites for quick access. Filter to show only favorite builds.
- **Installation indicator** — See at a glance which builds are already installed.
- **Download with progress tracking** — Start a download and track its progress in real time. Downloads can be cancelled at any time.
- **Release notes** — Read the changelog for any build, displayed in formatted Markdown.

### Configurations

Create and manage custom startup commands to launch llama.cpp servers.

- **Create custom command** — Define a name, description, and the command-line arguments to pass when launching `llama-server`.
- **Edit and delete** — Modify or delete any saved configuration.
- **Search** — Find configurations by name or description.
- **Link to a version** — Associate a configuration with a version card on the dashboard to enable one-click launching.

> **Tip:** You don't need to type `llama-server.exe` in your command — the app handles the executable path automatically when launching from a card.

### Terminals

A floating window dedicated to managing running llama.cpp servers.

- **Multiple sessions** — Run several servers simultaneously, each in its own terminal.
- **List View** — A sidebar displaying all sessions and showing one terminal at a time.
- **Grid View** — View all active terminals side-by-side.
- **Closing sessions** — Stop specific servers from the terminal window.

---

## Getting Started

1. **Browse builds** — Go to the **Catalog** and find a build that matches your hardware (e.g., CUDA if you have an NVIDIA GPU, or CPU otherwise).
2. **Download** — Click the download button on any build row. Progress appears in the bottom-right panel.
3. **Create a configuration** — Go to **Configurations** and create a startup command with your model path and arguments.
4. **Link and launch** — Back on the **Dashboard**, open a version card, link your configuration, and click **Play**.

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
