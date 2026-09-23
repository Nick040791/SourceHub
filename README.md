<div align="center">

<img src="public/sourcehub.svg" alt="SourceHub logo" width="88" />

# SourceHub

**A single-operator, self-hosted software forge with GitHub-Desktop-style source control, a local CI runner, and an autonomous AI coding agent — all on your own hardware.**

`v0.1.0-alpha` · Node.js (no web framework) · React 19 · Native Git

</div>

---

## What is SourceHub?

SourceHub turns a directory of plain git repositories on your machine into a fully-featured development hub served over the web:

- **Code Browser** — browse trees, blobs, commit history, and per-commit diffs for every repo it discovers.
- **Desktop** — a real source-control workbench (hunk-level staging, discard, stash, commit, push/pull/fetch, remote management) like GitHub Desktop, but for your local repos.
- **Issues & Pull Requests** — a full PR/issue lifecycle backed by SQLite, with merge conflict pre-flight, squash/merge/rebase strategies, CI check gating, post-merge issue auto-closing, and branch pruning.
- **Actions** — a local CI runner that executes workflows from `.sourcehub/workflows/` for real, with step-by-step logs.
- **Agents** — an autonomous AI coding agent ("SourceHub Helper") powered by any local Ollama model. It reads the whole repository, writes files, commits them to a working branch with an audit trailer, opens a PR, and triggers CI.
- **Git Smart HTTP** — clone and fetch any managed repo with plain git: `git clone http://<host>:5173/git/<repo>.git`.
- **Webhooks** — signed outbound webhook dispatch for pushes, PRs, agent runs, and more.

Everything runs locally. No cloud, no accounts, no telemetry.

---

## Feature Highlights

### 🖥️ Desktop (Source Control)
- Live working-copy status (modified / added / deleted / renamed / untracked) with ahead/behind tracking, upstream info, and stash list
- **Hunk-level staging** backed by `git apply --cached` unified patches
- Discard changes per file or all at once
- Commit with summary + description, and **undo last commit**
- Fetch / Pull / Push with upstream setup, plus assisted GitHub remote creation
- Add, update, and remove remotes
- Branch switching and deletion with active-branch safety checks

### 🤖 AI Agent — SourceHub Helper
1. Pick a base branch and describe the task in the Agents tab (or assign an issue directly to the agent).
2. The server snapshots the repository — full file tree, tracked file contents (with prompt-aware file ranking), recent commits, and the branch diff — and builds a single large-context prompt for the model.
3. The model replies with `<<<FILE: path/to/file.ext>>> … 