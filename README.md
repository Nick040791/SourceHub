<div align="center">

<img src="public/sourcehub.svg" alt="SourceHub logo" width="96" />

# SourceHub

**A single-operator, self-hosted software forge with native GitHub Desktop source control, local CI actions runner, and an autonomous AI coding agent — running entirely on your own hardware.**

[![Node.js](https://img.shields.io/badge/Node.js-22+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Git](https://img.shields.io/badge/Git-Native_CLI-F05032?logo=git&logoColor=white)](https://git-scm.com)
[![Status](https://img.shields.io/badge/Version-v0.1.0--alpha-00ff66)](#)

</div>

---

## 📖 Overview

**SourceHub** turns any directory of local git repositories (default: `~/Dev`) into a comprehensive, high-performance development forge served locally over the web and LAN.

Designed specifically for solo developers, single operators, and agentic AI pair programming, SourceHub replaces both GitHub and GitHub Desktop without relying on external cloud infrastructure, subscriptions, or telemetry:

- 🖥️ **Full Source Control Workbench** — Hunk-level staging, discard, auto-fill commits, undo commit, stash management, branch switching, and remote sync.
- **Autonomous AI Coding Agent ("Helper")** — Async task execution using local Ollama models. The agent snapshots the repository, ranks relevant files, writes code in an isolated git worktree, commits changes with audit trailers, opens PRs, runs reviews, and even addresses review comments automatically.
- 🔀 **Pull Requests & Code Review** — Full PR lifecycle backed by Node's built-in SQLite, featuring pre-flight merge conflict detection, squash/rebase/merge strategies, CI check gating, post-merge issue auto-closing, and branch pruning.
- ⚡ **Local Actions CI Runner** — Executes `.sourcehub/workflows/*.yml` locally with live step-by-step logs, status indicators, and duration tracking.
- 📋 **Issue Tracker** — Built-in issue lifecycle with one-click "Assign to Agent" handoff.
- 🌐 **Git Smart HTTP Wire Protocol** — Built-in Smart HTTP server allows standard `git clone http://<host>:5173/git/<repo>.git` over localhost and LAN.
- 🔒 **Secrets, Keys & Webhooks** — Encrypted repository/global secrets vault, SSH user & deploy keys, Personal Access Tokens (PATs), and HMAC-signed outbound webhooks with live ping testing.
- 🎨 **14 Themes & Profile Customization** — Matrix Neon (default), Cyber Amber, Tokyo Night, Dracula, OLED Black, and more, alongside persistent operator profile settings stored in SQLite.
- 🚀 **Zero Web Framework Overhead** — Powered by Node 22+ built-in `node:http` and `node:sqlite`, eliminating bloated web frameworks and native C++ binary dependencies.

---

## ⚡ Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                               Surfaces                                 │
│    Web Browser (LAN / Local)  │  Desktop App Launcher  │  Git CLI      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST / Git Smart HTTP
┌───────────────────────────────────▼────────────────────────────────────┐
│                    SourceHub Standalone Daemon                         │
│  Native Node 22+ HTTP Server (node:http)  │  No Express / No Fastify   │
├────────────────────────────────────────────────────────────────────────┤
│  • Git Service (Native CLI runner)        • Working Copy Status        │
│  • Hunk Staging / Apply Patch Engine      • Smart HTTP (Upload Pack)   │
│  • Pull Request & Merge Pre-flight        • Local Actions CI Runner    │
│  • AI Helper Service (Ollama Worktrees)   • Outbound Webhook Dispatch  │
├────────────────────────────────────────────────────────────────────────┤
│                      Storage & Execution Layer                         │
│  • Built-in SQLite (node:sqlite)  → ~/.sourcehub/sourcehub.db          │
│  • Repositories Directory         → ~/Dev/*                            │
│  • Isolated Agent Worktrees       → ~/.sourcehub/worktrees/*           │
│  • Local Ollama Daemon            → http://localhost:11434             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Features in Detail

### 🖥️ Desktop (Source Control Workbench)
- **Live Status Monitoring**: Tracks modified, added, deleted, renamed, and untracked files with ahead/behind commit indicators and upstream tracking.
- **Hunk-Level Staging**: Interactive unified diff view allowing staging or unstaging of individual hunks via native `git apply --cached`.
- **Auto-Fill Commit Fields**: Generates concise, conventional commit summaries and descriptions by analyzing staged diffs.
- **Safe Operations**: Discard changes per file, selection, or all working changes at once; undo last commit (`git reset --soft HEAD~1`).
- **Branch Management**: Quick branch switcher, new branch modal with base branch selection, and active branch deletion protection.
- **Stash Drawer**: Save working state to stash with custom messages, pop, apply, or drop stashes.
- **Remote Synchronization**: Manage multiple remotes (add, edit, remove), fetch, pull, and push with automatic upstream tracking setup, plus assisted GitHub remote integration.

---

### AI Agent — Helper
Helper is an asynchronous repository agent designed for autonomous code development:

1. **Context Snapshotting & File Ranking**: Rather than naive full-repo dumps, SourceHub uses semantic scoring to prioritize and rank relevant tracked files alongside branch diffs, tree structure, and commit history.
2. **Isolated Worktrees**: The agent performs all edits inside dedicated git worktrees (`~/.sourcehub/worktrees/<run-id>`), preventing interference with your active workspace.
3. **Robust Code Parsing**: Parses both structured multi-file blocks (`<<<FILE: path>>>...<<<END_FILE>>>`) and standard markdown headers.
4. **Audit Trailers**: Commits are authored using your operator identity with a transparent audit trailer: `SourceHub-Agent-Run: <run-id>`.
5. **PR Lifecycle Integration**:
   - **Autonomous PR Creation**: Opens a PR with AI-generated titles and descriptions.
   - **Automated PR Review**: Performs line-by-line automated code review on PR diffs.
   - **Address Review Comments**: The agent reads reviewer feedback, checks out the branch, implements the requested changes, commits them, and replies to comment threads.
6. **Ollama Integration**: Seamless model discovery from `localhost:11434` or custom endpoints, pre-configured for models like `glm-5.3-flash:cloud`, `llama3`, `deepseek-coder`, `qwen`, and more.

---

### 🔀 Pull Requests & Code Review
- **Rich Diff Viewer**: Side-by-side and unified diff views with syntax highlighting.
- **Pre-Flight Conflict Engine**: Checks mergeability against target branches in real time before attempting a merge.
- **3 Merge Strategies**: Support for **Squash and Merge**, **Rebase and Merge**, and **Create a Merge Commit**.
- **CI Check Gating**: Protects target branches by requiring passing Actions CI runs prior to merge.
- **Post-Merge Automation**: Automatically closes linked issues (e.g., `#1`, `Closes #4`) and prunes deleted feature branches.
- **Line & File Comments**: Real conversation threads on pull requests.

---

### ⚡ Local Actions (CI Runner)
- **Declarative Workflows**: Reads workflow definitions from `.sourcehub/workflows/*.yml`.
- **Real Local Execution**: Runs workflow commands step-by-step using native bash processes.
- **Audit & History**: Real-time log capture, exit code recording, execution timestamps, and run durations.
- **Event Triggers**: Dispatches automatically on `push`, `pull_request`, `agent_run`, or manual UI dispatch.

---

### 🌐 Git Smart HTTP Wire Protocol
- Clone and fetch directly with standard Git CLI tools:
  ```bash
  git clone http://localhost:5173/git/my-repo.git
  # Or from any device on your local network:
  git clone http://192.168.1.150:5173/git/my-repo.git
  ```
- Dynamic LAN IP detection displayed directly in the repository clone drawer.

---

### 🔒 Security, Keys & Webhooks
- **Encrypted Secrets Vault**: Store repository-scoped and global secrets with masked values for CI and agent workflows.
- **Keys Management**: Register and manage SSH user keys and deploy keys with fingerprint verification.
- **Personal Access Tokens (PATs)**: Issue granular API tokens with custom expiration policies.
- **Outbound Webhooks**: Dispatch event notifications with HMAC SHA-256 signatures (`X-SourceHub-Signature-256`) and built-in ping test tools.

---

### 🎨 Themes & Profile Customization
SourceHub features 14 tailored themes designed for readability and style:
- ⚡ **Matrix Neon** *(Default — Obsidian black with vivid electric green)*
- 📟 **Cyber Amber** *(Phosphor VT220 amber on onyx)*
- 🗼 **Tokyo Night** *(Midnight indigo with vibrant cyan & violet)*
- ☕ **Catppuccin Mocha** *(Warm pastel & lavender dark)*
- 🎨 **Monokai Pro** *(Charcoal with vivid yellow & lime)*
- 🌊 **Solarized Dark** *(Deep marine teal & amber)*
- 🌙 **High Contrast Dark** *(Ultra-crisp dark & azure)*
- 🌑 **GitHub Dark** *(Classic dimmed charcoal)*
- 🌌 **Midnight OLED** *(True 0x000 black)*
- 🧛 **Dracula** *(Iconic purple & cyan palette)*
- ❄️ **Nord Frost** *(Arctic blues & frost slate)*
- 🌆 **Synthwave 84** *(Neon pink & cyan glow)*
- ☀️ **High Contrast Light** *(Clean, crisp daylight)*
- 📜 **Warm Sepia** *(Warm parchment paper tone)*

Persist your operator profile (name, username, email, bio, initials, avatar gradient, and theme) across reloads in SQLite.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 22.0.0+** (Required for native `node:sqlite`)
- **Git 2.30+** installed on the system path
- *(Optional)* **Ollama** installed and running (`ollama serve`) for AI Helper capabilities

### Installation

#### Option 1: Pre-Built Debian Package (.deb)

Pre-compiled packages for Debian, Ubuntu, and Linux Mint are available in the [`releases/`](releases/) directory:

```bash
# Install package
sudo dpkg -i releases/sourcehub_0.1.0_amd64.deb

# Launch SourceHub (opens in default browser)
sourcehub
```

#### Option 2: Install from Source

```bash
# Clone the repository
git clone https://github.com/mrnicholas/SourceHub.git
cd SourceHub

# Install frontend and server dependencies
npm install
```

### Running in Development

```bash
npm run dev
```
Visit `http://localhost:5173` in your browser.

### Building & Running the Production Daemon

SourceHub includes a standalone production HTTP server powered by native `node:http`:

```bash
# Build the React 19 frontend
npm run build

# Start the standalone server
npm run serve
```

### Installing as a Systemd User Service

Run SourceHub automatically on login as a background service:

```bash
./scripts/install-service.sh
```

Manage the service with standard systemd commands:
```bash
# Check status
systemctl --user status sourcehub.service

# View live logs
journalctl --user -u sourcehub.service -f

# Stop or restart
systemctl --user stop sourcehub.service
systemctl --user restart sourcehub.service

# Uninstall service
./scripts/uninstall-service.sh
```

### Desktop Application Launcher
A pre-configured launcher script is available in `bin/`:
```bash
./bin/launch-sourcehub.sh
```
This checks if the SourceHub daemon is running, starts it if necessary, and opens the hub in your default browser.

---

## ⚙️ Configuration & Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `5173` | Port for the HTTP server to listen on. |
| `HOST` | `0.0.0.0` | Bind host address (`0.0.0.0` enables local network access). |
| `SOURCEHUB_REPOS_DIR` | `~/Dev` | Base directory containing git repositories to discover and manage. |
| `SOURCEHUB_DATA_DIR` | `~/.sourcehub` | Directory storing SQLite database (`sourcehub.db`), worktrees, and logs. |
| `NODE_ENV` | `development` | Set to `production` when serving static frontend bundles. |

AI provider settings (Ollama URL, default model) and user profile preferences can be configured directly in the **Settings** tab and **Profile Modal** within the web interface.

---

## 📁 Repository Structure

```
SourceHub/
├── bin/
│   └── launch-sourcehub.sh     # Desktop launcher script
├── docs/
│   └── SOURCEHUB_PLAN.md       # Product architecture and specification
├── public/
│   └── sourcehub.svg           # High-contrast logo & icon assets
├── scripts/
│   ├── install-service.sh      # Systemd user service installer
│   └── uninstall-service.sh    # Systemd user service uninstaller
├── server/
│   ├── agentService.ts         # Autonomous AI coding agent & worktree manager
│   ├── db.ts                   # Built-in SQLite database initialization (node:sqlite)
│   ├── gitService.ts           # Git CLI operations, Smart HTTP, and diff engines
│   ├── index.ts                # Production standalone daemon (node:http)
│   ├── vitePluginGitApi.ts     # API route handlers & development middleware
│   ├── webhookService.ts       # Outbound HMAC-signed webhook dispatcher
│   └── workflowService.ts      # Local Actions CI runner engine
├── src/
│   ├── components/
│   │   ├── actions/            # CI workflow execution views & log viewers
│   │   ├── agents/             # Helper AI session launcher & run tracker
│   │   ├── code/               # Tree browser, blob viewer, & doc preview
│   │   ├── desktop/            # Source control workbench (hunks, commit, stash)
│   │   ├── issues/             # Issue list, details, and agent assignment
│   │   ├── layout/             # App header, repo header, and hamburger menu
│   │   ├── pr/                 # PR comparison, diffs, reviews, and merge controls
│   │   ├── profile/            # Profile settings modal & 14 theme selectors
│   │   └── settings/           # Secrets, tokens, keys, webhooks, and AI config
│   ├── services/               # Frontend API client
│   ├── types/                  # Shared TypeScript interfaces
│   ├── App.tsx                 # Root application component
│   └── index.css               # Tailwind CSS & custom theme definitions
├── package.json
├── tailwind.config.js
└── vite.config.ts
```

---

## 🤝 Contributing & Local Development

SourceHub is built with simplicity and autonomy in mind:
- **No Heavy Frameworks**: The backend is pure Node.js. When adding API endpoints or git operations, keep them fast, deterministic, and dependency-light.
- **Keep Everything Local**: Do not introduce required dependencies on cloud services or external APIs.
- **Code Style**: Follow TypeScript standards and ensure code passes type-checking:
  ```bash
  npm run build
  ```

---

## 📄 License

MIT License. Designed and maintained for single-operator autonomy.
